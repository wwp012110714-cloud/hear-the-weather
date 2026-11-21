/**
 * 选歌：本地精选曲库 + 不重复
 *
 * - 曲库在 src/data/song-pool.json：每座城市 6–8 首「和这个地方有关」的歌，
 *   每种天气 12–14 首，每种曲风 10–14 首。
 * - song-ids.json 记录每首歌在 iTunes / Deezer 中的精确曲目 ID（scripts/resolve-songs.py 生成），
 *   没有查到 ID 的歌不会被选中。
 * - 每批最多 4 首本地歌，其余用天气歌补足；同一批内按歌名去重，绝不出现同一首歌的多个版本。
 * - 同一个地方（城市 + 曲风）已经出现过的歌记在 sessionStorage，换一批、重新进入都不会再出现，
 *   直到这个地方的曲库全部轮完，才开始新的一轮。
 * - 同天气的不同城市，用城市名做随机种子打乱天气歌的顺序，彼此不会是同一张歌单。
 */
import POOL from '../data/song-pool.json'
import IDS from '../data/song-ids.json'

export const songKey = (s) => `${s.t}|${s.a}`
export const songIds = (s) => IDS[songKey(s)] || null

const normTitle = (t) =>
  String(t || '')
    .toLowerCase()
    .replace(/[（(\[【].*?[)）\]】]/g, '')
    .replace(/[\s,，.。·'"!！?？\-]+/g, '')

export function cleanCityName(name = '') {
  return String(name).replace(/(市|地区|自治州|特别行政区|盟)$/, '')
}

function hash(str) {
  let h = 2166136261
  for (const ch of str) {
    h ^= ch.codePointAt(0)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function shuffled(list, seed) {
  const a = [...list]
  let s = seed || 1
  const rnd = () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ---------- 每个地方已出现过的歌 ---------- */
const SEEN_PREFIX = 'htw:seen:v1:'

export function placeKey(cityName, genreMode) {
  return `${cleanCityName(cityName)}|${genreMode}`
}

export function loadSeen(place) {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_PREFIX + place) || '[]'))
  } catch {
    return new Set()
  }
}

export function saveSeen(place, keys) {
  try {
    sessionStorage.setItem(SEEN_PREFIX + place, JSON.stringify([...keys]))
  } catch {
    /* 隐私模式下忽略 */
  }
}

/**
 * @param {object} o
 * @param {string} o.cityName
 * @param {string} o.poolKey   天气曲库：clear / cloudy / rain / storm / snow / night / hot
 * @param {string} o.genreMode auto 时用「城市 + 天气」，其余用对应曲风曲库
 * @param {Set}    o.seen      这个地方已经出现过的歌
 * @returns {{ songs: Array<{t:string,a:string}>, recycled: boolean, local: number }}
 */
// 当前天气的歌不够时，向相近天气借歌
const NEIGHBOURS = {
  clear: ['hot', 'cloudy'],
  cloudy: ['clear', 'rain', 'night'],
  rain: ['cloudy', 'night', 'storm'],
  storm: ['rain', 'night'],
  snow: ['night', 'cloudy'],
  night: ['cloudy', 'snow'],
  hot: ['clear', 'cloudy']
}

export function pickSongs({ cityName, poolKey, genreMode = 'auto', seen = new Set(), count = 8, source = 'any' }) {
  const city = cleanCityName(cityName)
  const seed = hash(`${city}|${poolKey}|${genreMode}`)
  // source = 'dz'：iTunes 在当前网络连不上，只挑 Deezer 上有的歌
  const usable = (s) => (source === 'dz' ? !!songIds(s)?.dz : !!songIds(s))
  const localList = genreMode === 'auto' || genreMode === 'folk' ? shuffled((POOL.city[city] || []).filter(usable), seed) : []
  const mainSrc = genreMode === 'auto' ? POOL.weather[poolKey] || POOL.weather.clear : POOL.genre[genreMode] || []
  const mainList = shuffled(mainSrc.filter(usable), seed + 7)
  const extraList =
    genreMode === 'auto'
      ? (NEIGHBOURS[poolKey] || []).flatMap((k, i) => shuffled((POOL.weather[k] || []).filter(usable), seed + 11 + i))
      : []

  const run = (allowSeen) => {
    const out = []
    const titles = new Set()
    let local = 0
    const take = (list, max, isLocal) => {
      for (const s of list) {
        if (out.length >= count || max <= 0) return
        const tk = normTitle(s.t)
        if (titles.has(tk)) continue
        if (!allowSeen && seen.has(songKey(s))) continue
        out.push(s)
        titles.add(tk)
        max--
        if (isLocal) local++
      }
    }
    take(localList, genreMode === 'folk' ? 2 : 4, true)
    take(mainList, count, false)
    take(extraList, count, false)
    return { songs: out, local }
  }

  const fresh = run(false)
  const minimum = Math.min(6, localList.length + mainList.length + extraList.length)
  if (fresh.songs.length >= minimum) return { ...fresh, recycled: false }
  // 这个地方的歌已经全部出现过：开始新的一轮
  return { ...run(true), recycled: true }
}
