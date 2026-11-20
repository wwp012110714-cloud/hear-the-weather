/**
 * 天气图几何工具
 * - 站点投影：按经纬度相对位置落点（不绘制任何地图轮廓）
 * - 等温线：用各站实况气温做反距离加权插值，再用 marching squares 求等值线
 * - 站点填图：云量（八分量）、风羽、天气现象
 */

/** 中国大陆及近海的经纬度包络，超出范围的城市不在图面落点 */
const CHINA_BOX = { minLon: 72, maxLon: 136, minLat: 16, maxLat: 55 }

export function inChinaBox(c) {
  return (
    c &&
    c.lon >= CHINA_BOX.minLon &&
    c.lon <= CHINA_BOX.maxLon &&
    c.lat >= CHINA_BOX.minLat &&
    c.lat <= CHINA_BOX.maxLat
  )
}

/**
 * 计算投影函数：将经纬度线性映射进给定矩形，保持经纬比例（按纬度中值做余弦校正）
 */
export function makeProjection(points, rect, pad = 0.08) {
  const list = points.filter(inChinaBox)
  if (!list.length) {
    return { project: () => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }), bounds: null }
  }
  let minLon = Math.min(...list.map((p) => p.lon))
  let maxLon = Math.max(...list.map((p) => p.lon))
  let minLat = Math.min(...list.map((p) => p.lat))
  let maxLat = Math.max(...list.map((p) => p.lat))
  const dLon = Math.max(6, maxLon - minLon)
  const dLat = Math.max(4, maxLat - minLat)
  minLon -= dLon * pad
  maxLon += dLon * pad
  minLat -= dLat * pad
  maxLat += dLat * pad

  const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180)
  const geoW = (maxLon - minLon) * Math.cos(midLat)
  const geoH = maxLat - minLat
  const scale = Math.min(rect.w / geoW, rect.h / geoH)
  const offX = rect.x + (rect.w - geoW * scale) / 2
  const offY = rect.y + (rect.h - geoH * scale) / 2

  const project = (p) => ({
    x: offX + (p.lon - minLon) * Math.cos(midLat) * scale,
    y: offY + (maxLat - p.lat) * scale
  })
  return { project, bounds: { minLon, maxLon, minLat, maxLat } }
}

/**
 * 反距离加权插值 + marching squares 生成等温线
 * @param stations [{x, y, value}]
 * @param box {x, y, w, h}  绘制区域
 * @param step 等值间隔（°C）
 * @returns [{level, d, label:{x,y}}]
 */
export function buildIsotherms(stations, box, step = 4, cols = 64, rows = 40) {
  const pts = stations.filter((s) => Number.isFinite(s.value))
  if (pts.length < 3) return []
  const smooth2 = (Math.min(box.w, box.h) * 0.09) ** 2

  const grid = []
  for (let j = 0; j <= rows; j++) {
    const row = []
    const y = box.y + (j / rows) * box.h
    for (let i = 0; i <= cols; i++) {
      const x = box.x + (i / cols) * box.w
      let num = 0
      let den = 0
      for (const p of pts) {
        // 加平滑项，避免反距离插值在孤立站点周围形成「牛眼」
        const d2 = (p.x - x) ** 2 + (p.y - y) ** 2 + smooth2
        const wgt = 1 / (d2 * Math.sqrt(d2))
        num += wgt * p.value
        den += wgt
      }
      row.push(num / den)
    }
    grid.push(row)
  }

  const values = pts.map((p) => p.value)
  const lo = Math.ceil(Math.min(...values) / step) * step
  const hi = Math.floor(Math.max(...values) / step) * step
  const cw = box.w / cols
  const ch = box.h / rows
  const result = []

  for (let level = lo; level <= hi; level += step) {
    const segs = []
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const v0 = grid[j][i]
        const v1 = grid[j][i + 1]
        const v2 = grid[j + 1][i + 1]
        const v3 = grid[j + 1][i]
        const x0 = box.x + i * cw
        const y0 = box.y + j * ch
        const lerp = (a, b) => (level - a) / (b - a || 1e-6)
        const top = () => [x0 + cw * lerp(v0, v1), y0]
        const right = () => [x0 + cw, y0 + ch * lerp(v1, v2)]
        const bottom = () => [x0 + cw * lerp(v3, v2), y0 + ch]
        const left = () => [x0, y0 + ch * lerp(v0, v3)]
        const idx = (v0 > level ? 8 : 0) | (v1 > level ? 4 : 0) | (v2 > level ? 2 : 0) | (v3 > level ? 1 : 0)
        switch (idx) {
          case 1:
          case 14:
            segs.push([left(), bottom()])
            break
          case 2:
          case 13:
            segs.push([bottom(), right()])
            break
          case 3:
          case 12:
            segs.push([left(), right()])
            break
          case 4:
          case 11:
            segs.push([top(), right()])
            break
          case 5:
            segs.push([left(), top()], [bottom(), right()])
            break
          case 6:
          case 9:
            segs.push([top(), bottom()])
            break
          case 7:
          case 8:
            segs.push([left(), top()])
            break
          case 10:
            segs.push([left(), bottom()], [top(), right()])
            break
          default:
            break
        }
      }
    }
    if (!segs.length) continue
    const lines = joinSegments(segs)
    const d = lines.map((l) => smoothPath(l)).join(' ')
    // 标注放在最长那条线的中点
    const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), lines[0])
    const mid = longest[Math.floor(longest.length / 2)]
    result.push({ level, d, label: { x: mid[0], y: mid[1] } })
  }
  return result
}

/** 把零散线段首尾相接成折线 */
function joinSegments(segs) {
  const key = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`
  const remaining = segs.slice()
  const lines = []
  while (remaining.length) {
    const line = remaining.pop().slice()
    let grew = true
    while (grew) {
      grew = false
      for (let k = remaining.length - 1; k >= 0; k--) {
        const [a, b] = remaining[k]
        const head = key(line[0])
        const tail = key(line[line.length - 1])
        if (key(a) === tail) line.push(b)
        else if (key(b) === tail) line.push(a)
        else if (key(b) === head) line.unshift(a)
        else if (key(a) === head) line.unshift(b)
        else continue
        remaining.splice(k, 1)
        grew = true
      }
    }
    if (line.length > 3) lines.push(line)
  }
  return lines
}

/** Catmull-Rom 平滑折线 → 三次贝塞尔路径 */
export function smoothPath(pts) {
  if (!pts.length) return ''
  if (pts.length < 3) return `M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L')}`
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d
}

/** 云量八分量：优先实测云量百分比，否则按天气代码估计 */
export function cloudOktas(code = 0, cloudCover = null) {
  if (Number.isFinite(cloudCover)) return Math.round((cloudCover / 100) * 8)
  if (code === 0) return 0
  if (code === 1) return 2
  if (code === 2) return 4
  if (code === 45 || code === 48) return 9 // 天空不明（雾）
  return 8
}

/** 天气现象分类（决定站点左侧的现象符号） */
export function presentWeather(code = 0) {
  if (code >= 95) return 'storm'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 80 && code <= 82) return 'shower'
  if (code >= 61 && code <= 67) return 'rain'
  if (code >= 51 && code <= 57) return 'drizzle'
  if (code === 45 || code === 48) return 'fog'
  return null
}

/**
 * 风羽几何：从站圈指向来风方向的杆，末端按风速画长羽（10 节）/短羽（5 节）/风三角（50 节）
 * @returns {shaft:[x1,y1,x2,y2], barbs:[[x1,y1,x2,y2]], flags:[points]} 以站心为原点
 */
export function windBarb(speedKmh, fromDeg, r = 7, len = 26, feather = 10) {
  if (!Number.isFinite(speedKmh) || !Number.isFinite(fromDeg)) return null
  const knots = speedKmh / 1.852
  const rad = (fromDeg * Math.PI) / 180
  const ux = Math.sin(rad)
  const uy = -Math.cos(rad)
  // 羽毛朝向：北半球画在杆的顺时针一侧
  const px = -uy
  const py = ux
  const sx = ux * r
  const sy = uy * r
  const ex = ux * (r + len)
  const ey = uy * (r + len)
  if (knots < 2.5) {
    return { calm: true, shaft: null, barbs: [], flags: [] }
  }
  let remain = Math.round(knots / 5) * 5
  const barbs = []
  const flags = []
  let pos = 0
  const gap = feather * 0.42
  const at = (t) => [ex - ux * t, ey - uy * t]
  while (remain >= 50) {
    const [ax, ay] = at(pos)
    const [bx, by] = at(pos + gap * 1.4)
    flags.push(`${ax},${ay} ${ax + px * feather + ux * 2},${ay + py * feather + uy * 2} ${bx},${by}`)
    pos += gap * 1.8
    remain -= 50
  }
  while (remain >= 10) {
    const [ax, ay] = at(pos)
    barbs.push([ax, ay, ax + px * feather + ux * 3, ay + py * feather + uy * 3])
    pos += gap
    remain -= 10
  }
  if (remain >= 5) {
    if (pos === 0) pos = gap
    const [ax, ay] = at(pos)
    barbs.push([ax, ay, ax + px * feather * 0.55 + ux * 1.6, ay + py * feather * 0.55 + uy * 1.6])
  }
  return { calm: false, shaft: [sx, sy, ex, ey], barbs, flags }
}

/** 风力等级（蒲福） */
export function beaufort(kmh) {
  const t = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118]
  let lv = 0
  while (lv < t.length && kmh >= t[lv]) lv++
  return lv
}

/**
 * 站点避让：距离过近的站点互相推开（只移动图面位置，不改变读数）
 * @param items [{x, y, selected}]，原地修改
 */
export function declutter(items, rect, minD = 54, rounds = 60) {
  for (let k = 0; k < rounds; k++) {
    let moved = false
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]
        const b = items[j]
        const need = a.selected || b.selected ? minD * 1.35 : minD
        let dx = b.x - a.x
        let dy = b.y - a.y
        let d = Math.hypot(dx, dy)
        if (d >= need) continue
        if (d < 0.01) {
          dx = 1
          dy = 0
          d = 1
        }
        const push = (need - d) / 2
        const ux = dx / d
        const uy = dy / d
        a.x -= ux * push
        a.y -= uy * push * 0.8
        b.x += ux * push
        b.y += uy * push * 0.8
        moved = true
      }
    }
    for (const it of items) {
      it.x = Math.min(rect.x + rect.w, Math.max(rect.x, it.x))
      it.y = Math.min(rect.y + rect.h, Math.max(rect.y, it.y))
    }
    if (!moved) break
  }
  return items
}
