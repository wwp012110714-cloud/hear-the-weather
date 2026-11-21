/**
 * 公共 API 数据服务层
 * 全部严格出自 GitHub public-apis/public-apis 官方免费免密钥（Auth: No, HTTPS: Yes, CORS: *）名录：
 * 1. Open-Meteo API (Weather & Environment 分类) — 中文城市检索、PM2.5/AQI 空气质量、实时气象与预报
 * 2. Meteorologisk Institutt / MET Norway API (Weather 分类) — 全球高精度气象双源竞速容灾
 * 3. Apple iTunes Search API (Music 分类) — 华语流行与网络热歌人声检索、高清专辑封面与音频试听流
 * 4. Radio Browser API (Music 分类) — 国内在线 FM 音乐广播电台检索（蜻蜓FM .cn 纯 MP3 全长音乐直播流）
 * 5. Hong Kong Observatory Open Data API (Weather 分类) — 中国传统农历干支与节令日期
 * 6. Deezer API (Music 分类) — iTunes 不可达时的备用人声曲库（JSONP + MP3 试听流）
 */

const DEFAULT_HEADERS =
  typeof window === 'undefined'
    ? {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      }
    : undefined

async function fetchJsonWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: DEFAULT_HEADERS
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * JSONP 通道：通过 <script> 标签加载接口，完全绕开 fetch 的 CORS/预检/代理拦截。
 * 部分国内校园网、移动网络与浏览器插件会拦截跨域 fetch，但 <script> 加载依然可用。
 */
let jsonpSeq = 0
function fetchJsonp(url, timeoutMs = 10000, callbackParam = 'callback') {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('JSONP unavailable'))
  }
  return new Promise((resolve, reject) => {
    const cbName = `__htw_jsonp_${Date.now()}_${jsonpSeq++}`
    const script = document.createElement('script')
    let done = false
    const cleanup = () => {
      done = true
      clearTimeout(timer)
      try {
        delete window[cbName]
      } catch {
        window[cbName] = undefined
      }
      script.remove()
    }
    const timer = setTimeout(() => {
      if (!done) {
        cleanup()
        reject(new Error('JSONP timeout'))
      }
    }, timeoutMs)
    window[cbName] = (data) => {
      if (done) return
      cleanup()
      resolve(data)
    }
    script.onerror = () => {
      if (done) return
      cleanup()
      reject(new Error('JSONP network error'))
    }
    const sep = url.includes('?') ? '&' : '?'
    script.src = `${url}${sep}${callbackParam}=${cbName}`
    document.head.appendChild(script)
  })
}

/**
 * 双通道竞速：先发起 CORS fetch，1.5 秒内未成功则并行追加 JSONP 通道，谁先返回用谁。
 */
function fetchJsonDualChannel(url, timeoutMs = 12000, jsonpUrl = url, callbackParam = 'callback') {
  const viaFetch = fetchJsonWithTimeout(url, timeoutMs)
  if (typeof document === 'undefined') return viaFetch
  const viaJsonp = new Promise((resolve, reject) => {
    let started = false
    const start = () => {
      if (started) return
      started = true
      fetchJsonp(jsonpUrl, timeoutMs, callbackParam).then(resolve, reject)
    }
    const t = setTimeout(start, 1500)
    viaFetch.catch(() => {
      clearTimeout(t)
      start()
    })
  })
  return Promise.any([viaFetch, viaJsonp])
}

function parseMetSymbol(symbolCode = 'clearsky_day', fallbackIsDay = 1) {
  const isNight = symbolCode.includes('_night') || symbolCode.includes('_polartwilight')
  const isDay = symbolCode.includes('_day') ? 1 : isNight ? 0 : fallbackIsDay
  const base = symbolCode.replace(/_(day|night|polartwilight)$/, '')

  let code = 1
  if (base === 'clearsky') code = 0
  else if (base === 'fair') code = 1
  else if (base === 'partlycloudy') code = 2
  else if (base === 'cloudy') code = 3
  else if (base === 'fog') code = 45
  else if (base.includes('thunder')) code = 95
  else if (base.includes('snow') || base.includes('sleet')) {
    code = base.startsWith('heavy') ? 75 : base.startsWith('light') ? 71 : 73
  } else if (base.includes('rain')) {
    code = base.startsWith('heavy') ? 65 : base.startsWith('light') ? 51 : 61
  }

  return { code, isDay }
}

function calcSunTimesUtc8(lat, lon, dateStr) {
  const d = new Date(`${dateStr}T12:00:00+08:00`)
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 0))
  const dayOfYear = Math.floor((d - start) / 86400000)
  const rad = Math.PI / 180
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1)

  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma))

  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma)

  const cosHa =
    Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) -
    Math.tan(lat * rad) * Math.tan(decl)

  if (cosHa > 1 || cosHa < -1) {
    return { sunrise: '06:30', sunset: '18:00' }
  }

  const haDeg = Math.acos(cosHa) / rad
  const sunriseUtcMin = 720 - 4 * (lon + haDeg) - eqTime
  const sunsetUtcMin = 720 - 4 * (lon - haDeg) - eqTime

  const fmt = (utcMin) => {
    const bjMin = ((Math.round(utcMin + 480) % 1440) + 1440) % 1440
    const hh = String(Math.floor(bjMin / 60)).padStart(2, '0')
    const mm = String(bjMin % 60).padStart(2, '0')
    return `${hh}:${mm}`
  }

  return {
    sunrise: fmt(sunriseUtcMin),
    sunset: fmt(sunsetUtcMin)
  }
}

function toBeijingIso(isoUtc) {
  const ms = new Date(isoUtc).getTime() + 8 * 3600 * 1000
  return new Date(ms).toISOString().slice(0, 16)
}

/**
 * 1. 中文城市地理编码搜索（Open-Meteo Geocoding API）
 */
export async function searchCities(keyword) {
  const q = keyword.trim()
  if (!q) return []

  const queries = [q]
  if (/^[\u4e00-\u9fa5]{2,3}$/.test(q) && !q.endsWith('市') && !q.endsWith('县') && !q.endsWith('区')) {
    queries.push(`${q}市`)
  }

  const responses = await Promise.allSettled(
    queries.map((term) =>
      fetchJsonWithTimeout(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=8&language=zh&format=json`,
        7000
      )
    )
  )

  const merged = []
  const seen = new Set()

  for (const r of responses) {
    if (r.status === 'fulfilled' && Array.isArray(r.value?.results)) {
      for (const item of r.value.results) {
        const key = `${item.latitude.toFixed(2)},${item.longitude.toFixed(2)}`
        if (!seen.has(key)) {
          seen.add(key)
          merged.push({
            id: `geo-${item.id || key}`,
            name: item.name,
            region: item.admin1 || item.country || '',
            countryCode: item.country_code || '',
            lat: item.latitude,
            lon: item.longitude,
            elevation: item.elevation,
            population: item.population || 0
          })
        }
      }
    }
  }

  const domesticCodes = new Set(['CN', 'HK', 'MO', 'TW'])
  merged.sort((a, b) => {
    const aDom = domesticCodes.has(a.countryCode) ? 1 : 0
    const bDom = domesticCodes.has(b.countryCode) ? 1 : 0
    if (aDom !== bDom) return bDom - aDom
    return (b.population || 0) - (a.population || 0)
  })

  return merged.slice(0, 8)
}

/**
 * 2. 批量拉取顶栏漫游城市的实时温度与天气状态
 */
export async function fetchBatchCityWeather(cities) {
  if (!cities?.length) return {}

  const openMeteoJob = (async () => {
    const lats = cities.map((c) => c.lat).join(',')
    const lons = cities.map((c) => c.lon).join(',')
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m,cloud_cover&timezone=Asia%2FShanghai`
    const data = await fetchJsonWithTimeout(url, 4500)
    const list = Array.isArray(data) ? data : [data]
    const result = {}
    cities.forEach((city, idx) => {
      const cur = list[idx]?.current
      if (cur) {
        result[city.id] = {
          temp: Math.round(cur.temperature_2m),
          code: cur.weather_code,
          isDay: cur.is_day,
          windSpeed: cur.wind_speed_10m ?? null,
          windDirection: cur.wind_direction_10m ?? null,
          cloudCover: cur.cloud_cover ?? null
        }
      }
    })
    if (Object.keys(result).length === 0) throw new Error('empty batch')
    return result
  })()

  const metNorwayJob = (async () => {
    const settled = await Promise.allSettled(
      cities.map((c) =>
        fetchJsonWithTimeout(
          `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${c.lat.toFixed(3)}&lon=${c.lon.toFixed(3)}`,
          6000
        )
      )
    )
    const fallback = {}
    cities.forEach((city, idx) => {
      const item = settled[idx]
      if (item.status === 'fulfilled') {
        const ts0 = item.value?.properties?.timeseries?.[0]
        const temp = ts0?.data?.instant?.details?.air_temperature
        const sym =
          ts0?.data?.next_1_hours?.summary?.symbol_code ||
          ts0?.data?.next_6_hours?.summary?.symbol_code ||
          'clearsky_day'
        if (temp != null) {
          const parsed = parseMetSymbol(sym, 1)
          const det = ts0?.data?.instant?.details || {}
          fallback[city.id] = {
            temp: Math.round(temp),
            code: parsed.code,
            isDay: parsed.isDay,
            windSpeed: det.wind_speed != null ? Math.round(det.wind_speed * 36) / 10 : null,
            windDirection: det.wind_from_direction ?? null,
            cloudCover: det.cloud_area_fraction ?? null
          }
        }
      }
    })
    if (Object.keys(fallback).length === 0) throw new Error('empty met batch')
    return fallback
  })()

  try {
    return await Promise.any([openMeteoJob, metNorwayJob])
  } catch {
    return {}
  }
}

async function fetchFromOpenMeteo(lat, lon) {
  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m` +
    `&hourly=temperature_2m,precipitation_probability,weather_code,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,wind_speed_10m_max` +
    `&timezone=Asia%2FShanghai&forecast_days=7`

  const w = await fetchJsonWithTimeout(weatherUrl, 4500)

  const nowIsoHour = w.current?.time?.slice(0, 13) || ''
  let startIdx = w.hourly?.time?.findIndex((t) => t.slice(0, 13) >= nowIsoHour) ?? 0
  if (startIdx < 0) startIdx = 0

  const hourly24 = []
  for (let i = startIdx; i < Math.min(startIdx + 24, w.hourly?.time?.length || 0); i++) {
    hourly24.push({
      time: w.hourly.time[i],
      hourLabel: i === startIdx ? '现在' : w.hourly.time[i].slice(11, 16),
      temp: w.hourly.temperature_2m[i],
      pop: w.hourly.precipitation_probability?.[i] ?? 0,
      code: w.hourly.weather_code[i],
      isDay: w.hourly.is_day?.[i] ?? 1
    })
  }

  const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const daily7 = (w.daily?.time || []).map((dateStr, idx) => {
    const d = new Date(`${dateStr}T00:00:00`)
    return {
      date: dateStr,
      dayLabel: idx === 0 ? '今天' : idx === 1 ? '明天' : weekNames[d.getDay()],
      shortDate: dateStr.slice(5).replace('-', '/'),
      code: w.daily.weather_code[idx],
      maxTemp: w.daily.temperature_2m_max[idx],
      minTemp: w.daily.temperature_2m_min[idx],
      sunrise: w.daily.sunrise?.[idx]?.slice(11, 16) || '06:30',
      sunset: w.daily.sunset?.[idx]?.slice(11, 16) || '18:00',
      uvMax: w.daily.uv_index_max?.[idx] ?? 0,
      popMax: w.daily.precipitation_probability_max?.[idx] ?? 0,
      windMax: w.daily.wind_speed_10m_max?.[idx] ?? 8
    }
  })

  return {
    provider: 'Open-Meteo',
    elevation: w.elevation ?? null,
    observationTime: w.current?.time?.slice(11, 16) || '',
    current: {
      temp: w.current.temperature_2m,
      apparentTemp: w.current.apparent_temperature,
      humidity: Math.round(w.current.relative_humidity_2m),
      isDay: w.current.is_day,
      precipitation: w.current.precipitation ?? 0,
      code: w.current.weather_code,
      cloudCover: Math.round(w.current.cloud_cover ?? 0),
      pressure: Math.round(w.current.surface_pressure ?? 1013),
      windSpeed: Math.round(w.current.wind_speed_10m * 10) / 10,
      windDirection: w.current.wind_direction_10m
    },
    hourly24,
    daily7
  }
}

async function fetchFromMetNorway(lat, lon) {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`
  const raw = await fetchJsonWithTimeout(url, 7500)
  const series = raw?.properties?.timeseries
  if (!Array.isArray(series) || series.length === 0) {
    throw new Error('MET 气象时间序列为空')
  }

  const nowMs = Date.now()
  let curIdx = series.findIndex((s) => new Date(s.time).getTime() >= nowMs - 1800 * 1000)
  if (curIdx < 0) curIdx = 0

  const curItem = series[curIdx]
  const curDetails = curItem.data?.instant?.details || {}
  const curSym =
    curItem.data?.next_1_hours?.summary?.symbol_code ||
    curItem.data?.next_6_hours?.summary?.symbol_code ||
    'clearsky_day'
  const curParsed = parseMetSymbol(curSym, 1)
  const curBj = toBeijingIso(curItem.time)

  const hourly24 = []
  for (let i = curIdx; i < Math.min(curIdx + 24, series.length); i++) {
    const item = series[i]
    const det = item.data?.instant?.details || {}
    const sym =
      item.data?.next_1_hours?.summary?.symbol_code ||
      item.data?.next_6_hours?.summary?.symbol_code ||
      curSym
    const parsed = parseMetSymbol(sym, curParsed.isDay)
    const bj = toBeijingIso(item.time)
    const precip =
      item.data?.next_1_hours?.details?.precipitation_amount ??
      item.data?.next_6_hours?.details?.precipitation_amount ??
      0
    hourly24.push({
      time: bj,
      hourLabel: i === curIdx ? '现在' : bj.slice(11, 16),
      temp: det.air_temperature ?? 18,
      pop: precip > 0 ? Math.min(95, Math.round(25 + precip * 18)) : 0,
      code: parsed.code,
      isDay: parsed.isDay
    })
  }

  const byDate = new Map()
  for (const item of series) {
    const bj = toBeijingIso(item.time)
    const dateKey = bj.slice(0, 10)
    const hourNum = Number(bj.slice(11, 13))
    const det = item.data?.instant?.details || {}
    const sym =
      item.data?.next_1_hours?.summary?.symbol_code ||
      item.data?.next_6_hours?.summary?.symbol_code ||
      'partlycloudy_day'
    const parsed = parseMetSymbol(sym, 1)
    const precip =
      item.data?.next_1_hours?.details?.precipitation_amount ??
      item.data?.next_6_hours?.details?.precipitation_amount ??
      0

    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, {
        temps: [],
        winds: [],
        uvs: [],
        precips: [],
        middayCode: parsed.code,
        middayDist: Math.abs(hourNum - 13)
      })
    }
    const bucket = byDate.get(dateKey)
    if (det.air_temperature != null) bucket.temps.push(det.air_temperature)
    if (det.wind_speed != null) bucket.winds.push(det.wind_speed * 3.6)
    if (det.ultraviolet_index_clear_sky != null) bucket.uvs.push(det.ultraviolet_index_clear_sky)
    bucket.precips.push(precip)

    if (Math.abs(hourNum - 13) < bucket.middayDist) {
      bucket.middayDist = Math.abs(hourNum - 13)
      bucket.middayCode = parsed.code
    }
  }

  const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const daily7 = Array.from(byDate.entries())
    .slice(0, 7)
    .map(([dateStr, b], idx) => {
      const d = new Date(`${dateStr}T00:00:00`)
      const sun = calcSunTimesUtc8(lat, lon, dateStr)
      const maxP = Math.max(0, ...b.precips)
      return {
        date: dateStr,
        dayLabel: idx === 0 ? '今天' : idx === 1 ? '明天' : weekNames[d.getDay()],
        shortDate: dateStr.slice(5).replace('-', '/'),
        code: b.middayCode,
        maxTemp: b.temps.length ? Math.max(...b.temps) : 20,
        minTemp: b.temps.length ? Math.min(...b.temps) : 10,
        sunrise: sun.sunrise,
        sunset: sun.sunset,
        uvMax: b.uvs.length ? Math.max(...b.uvs) : 3.5,
        popMax: maxP > 0 ? Math.min(95, Math.round(30 + maxP * 15)) : 0,
        windMax: b.winds.length ? Math.round(Math.max(...b.winds) * 10) / 10 : 9
      }
    })

  const curPrecip = curItem.data?.next_1_hours?.details?.precipitation_amount ?? 0
  const windKmh = Math.round(((curDetails.wind_speed ?? 2) * 3.6) * 10) / 10

  return {
    provider: 'MET Norway',
    elevation: raw?.geometry?.coordinates?.[2] ?? null,
    observationTime: curBj.slice(11, 16),
    current: {
      temp: curDetails.air_temperature ?? 18,
      apparentTemp: curDetails.apparent_air_temperature ?? curDetails.air_temperature ?? 18,
      humidity: Math.round(curDetails.relative_humidity ?? 50),
      isDay: curParsed.isDay,
      precipitation: curPrecip,
      code: curParsed.code,
      cloudCover: Math.round(curDetails.cloud_area_fraction ?? 0),
      pressure: Math.round(curDetails.air_pressure_at_sea_level ?? 1013),
      windSpeed: windKmh,
      windDirection: curDetails.wind_from_direction ?? 0
    },
    hourly24,
    daily7
  }
}

/**
 * 3. 拉取选定城市的完整实时气象与空气质量
 */
export async function fetchCityFullWeather(lat, lon) {
  const aqiUrl =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
    `&current=pm10,pm2_5,us_aqi&timezone=Asia%2FShanghai`

  const [weatherRes, aqiRes] = await Promise.allSettled([
    Promise.any([fetchFromOpenMeteo(lat, lon), fetchFromMetNorway(lat, lon)]),
    fetchJsonWithTimeout(aqiUrl, 6500)
  ])

  if (weatherRes.status !== 'fulfilled') {
    throw new Error('实时气象公共接口暂时繁忙，请点击重试')
  }

  const base = weatherRes.value
  const aqiData = aqiRes.status === 'fulfilled' ? aqiRes.value?.current : null

  return {
    ...base,
    airQuality: aqiData
      ? {
          aqi: aqiData.us_aqi,
          pm25: aqiData.pm2_5,
          pm10: aqiData.pm10
        }
      : null
  }
}

/**
 * 4. 拉取当日中国传统农历日期（中国香港天文台开放数据 API）
 */
export async function fetchLunarDate(dateObj = new Date()) {
  const yyyy = dateObj.getFullYear()
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0')
  const dd = String(dateObj.getDate()).padStart(2, '0')
  const url = `https://data.weather.gov.hk/weatherAPI/opendata/lunardate.php?date=${yyyy}-${mm}-${dd}`
  const data = await fetchJsonWithTimeout(url, 6500)
  if (data?.LunarYear && data?.LunarDate) {
    const yearClean = data.LunarYear.replace('，', '·')
    return `${yearClean} ${data.LunarDate}`
  }
  return ''
}

/**
 * 为电台生成高辨识度的 SVG 数据封面
 */
function buildStationCoverSvg(title, idx = 0) {
  const palettes = [
    ['#0F2942', '#38BDF8'],
    ['#1F2937', '#F59E0B'],
    ['#172554', '#A78BFA'],
    ['#134E4A', '#34D399'],
    ['#3B0764', '#FB7185']
  ]
  const [c1, c2] = palettes[idx % palettes.length]
  const short = (title || 'FM').slice(0, 4)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/><circle cx="150" cy="150" r="108" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="2"/><text x="150" y="142" text-anchor="middle" fill="#FFFFFF" font-size="34" font-family="sans-serif" font-weight="bold">${short}</text><text x="150" y="182" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-size="18" font-family="sans-serif">LIVE FM · MP3</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/**
 * 5. 动态拉取国内在线 FM 音乐广播电台（Radio Browser API — public-apis Music 分类）
 * 返回国内 .cn 蜻蜓FM 等纯 MP3 (audio/mpeg) 24 小时全长音乐流，任何浏览器 100% 原生秒播！
 */
export async function fetchDomesticMusicStations(weatherCategory = 'clear', isDay = 1) {
  const mirrors = [
    'https://de1.api.radio-browser.info',
    'https://at1.api.radio-browser.info',
    'https://nl1.api.radio-browser.info',
    'https://fi1.api.radio-browser.info'
  ]

  const path = '/json/stations/search?countrycode=CN&codec=MP3&https=true&hidebroken=true&order=clickcount&reverse=true&limit=45'
  let rawStations = null
  try {
    // 多镜像节点并行竞速，谁先返回非空列表用谁
    rawStations = await Promise.any(
      mirrors.map(async (host) => {
        const list = await fetchJsonWithTimeout(`${host}${path}`, 12000)
        if (!Array.isArray(list) || list.length === 0) throw new Error('empty')
        return list
      })
    )
  } catch {
    rawStations = null
  }

  if (!Array.isArray(rawStations) || rawStations.length === 0) {
    throw new Error('国内音乐广播列表获取超时，请点击重试')
  }

  const musicRegex = /(音乐|动感|经典|金曲|流行|云梦|星空|清晨|怀集|亚洲|FM101|94\.7|103\.7)/i
  const excludeRegex = /(新闻|交通|经济|农村|戏曲|评书|故事|伴音|CCTV|CNR-1)/i

  const filtered = rawStations.filter((s) => {
    const label = `${s.name || ''} ${s.tags || ''}`
    const url = s.url_resolved || ''
    return (
      url.startsWith('https://') &&
      musicRegex.test(label) &&
      !excludeRegex.test(s.name || '')
    )
  })

  // 根据当前天气状态对国内音乐台进行契合度智能排序
  const scoreStation = (s) => {
    const txt = `${s.name} ${s.tags}`.toLowerCase()
    let score = 0
    if (!isDay && /(星空|夜|云梦|经典)/.test(txt)) score += 30
    if ((weatherCategory === 'rain' || weatherCategory === 'cloudy') && /(云梦|雨|轻|经典|怀集)/.test(txt)) score += 30
    if (weatherCategory === 'snow' && /(古典|经典|94\.7)/.test(txt)) score += 30
    if (weatherCategory === 'clear' && isDay && /(清晨|动感|流行|动听|亚洲)/.test(txt)) score += 30
    if ((s.url_resolved || '').includes('qtfm.cn') || (s.url_resolved || '').includes('qingting.fm')) score += 15
    return score
  }

  filtered.sort((a, b) => scoreStation(b) - scoreStation(a))

  const seenUrls = new Set()
  const stations = []
  filtered.forEach((s, idx) => {
    const cleanUrl = (s.url_resolved || '').split('?')[0]
    if (!cleanUrl || seenUrls.has(cleanUrl)) return
    seenUrls.add(cleanUrl)
    const cover = buildStationCoverSvg(s.name.trim(), idx)
    stations.push({
      id: `radio-${s.stationuuid || idx}`,
      title: s.name.trim(),
      artist: '国内实况音乐广播',
      album: '24小时全长连播 · MP3',
      genre: '全长直播',
      releaseYear: 'LIVE',
      durationMs: 0,
      previewUrl: s.url_resolved,
      isLiveStream: true,
      coverSm: s.favicon && s.favicon.startsWith('https://') ? s.favicon : cover,
      coverLg: cover
    })
  })

  return stations.slice(0, 14)
}

/**
 * iTunes 检索的稳定性处理
 * - Apple 对同一 IP 大约每分钟只允许 20 次检索，超出后一段时间内全部拒绝。
 *   以前每次换城市、换曲风、换一批都要连发 4 次请求，很快就会被限流，
 *   然后整页退回「国内 FM 直播」——这就是「推歌全是电台」的主要原因。
 * - 现在：同一检索词的结果在本地缓存 12 小时；最多两个请求同时进行；
 *   每分钟请求数接近上限时，先只用缓存，不再白白消耗额度；
 *   失败时记录具体原因（超时 / 被拒绝 / 限流），便于在页面上说明。
 */
const IT_CACHE_PREFIX = 'htw:it:v1:'
const IT_CACHE_TTL = 12 * 3600 * 1000
const IT_RATE_WINDOW = 60 * 1000
const IT_RATE_MAX = 15
const itStamps = []
let itActive = 0
const itWaiters = []

function itCacheGet(key) {
  try {
    const raw = localStorage.getItem(IT_CACHE_PREFIX + key)
    if (!raw) return null
    const { at, data } = JSON.parse(raw)
    if (Date.now() - at > IT_CACHE_TTL) return null
    return data
  } catch {
    return null
  }
}

function itCacheSet(key, data) {
  try {
    localStorage.setItem(IT_CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), data }))
  } catch {
    // 存储已满时清掉旧缓存再试一次
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(IT_CACHE_PREFIX))
        .forEach((k) => localStorage.removeItem(k))
      localStorage.setItem(IT_CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), data }))
    } catch {
      /* 放弃缓存 */
    }
  }
}

function itRateLeft() {
  const now = Date.now()
  while (itStamps.length && now - itStamps[0] > IT_RATE_WINDOW) itStamps.shift()
  return IT_RATE_MAX - itStamps.length
}

async function itSlot() {
  if (itActive < 2) {
    itActive++
    return
  }
  await new Promise((r) => itWaiters.push(r))
  itActive++
}

function itRelease() {
  itActive--
  const next = itWaiters.shift()
  if (next) next()
}

function classifyError(err) {
  const m = String(err?.message || err || '')
  if (m === 'RATE') return '请求太频繁'
  if (/timeout|abort/i.test(m)) return '连接超时'
  if (/HTTP 4\d\d/.test(m)) return '请求被拒绝'
  return '连接失败'
}

/**
 * 记住哪条通道在当前网络下能用（fetch 或 JSONP），之后只走这一条：
 * 双通道同时发会让 Apple 把一次检索算成两次，更快触发限流。
 */
let itChannel = null
function itNetwork(url) {
  if (typeof document === 'undefined') {
    itStamps.push(Date.now())
    return fetchJsonWithTimeout(url, 15000)
  }
  if (itChannel === 'jsonp') {
    itStamps.push(Date.now())
    return fetchJsonp(url, 15000)
  }
  if (itChannel === 'fetch') {
    itStamps.push(Date.now())
    return fetchJsonWithTimeout(url, 12000).catch((err) => {
      if (/HTTP 4\d\d/.test(err?.message)) throw err
      itChannel = null
      itStamps.push(Date.now())
      return fetchJsonp(url, 15000).then((d) => ((itChannel = 'jsonp'), d))
    })
  }
  // 还不知道哪条通道可用：先 fetch，2.5 秒没结果或失败再追加 JSONP，谁先成功记住谁
  return new Promise((resolve, reject) => {
    let done = false
    let outstanding = 0
    let jsonpFired = false
    let timer = null
    const win = (ch) => (d) => {
      if (done) return
      done = true
      clearTimeout(timer)
      itChannel = ch
      resolve(d)
    }
    const lose = (err) => {
      outstanding--
      if (!done && outstanding === 0 && jsonpFired) {
        done = true
        reject(err)
      }
    }
    const fireJsonp = () => {
      if (jsonpFired || done) return
      jsonpFired = true
      outstanding++
      itStamps.push(Date.now())
      fetchJsonp(url, 15000).then(win('jsonp'), lose)
    }
    outstanding++
    itStamps.push(Date.now())
    timer = setTimeout(fireJsonp, 2500)
    fetchJsonWithTimeout(url, 15000).then(win('fetch'), (err) => {
      if (!jsonpFired) {
        clearTimeout(timer)
        // 明确被拒绝（如限流 403）时，换通道也一样会被拒，直接报错
        if (/HTTP 4\d\d/.test(err?.message)) {
          done = true
          reject(err)
          return
        }
        fireJsonp()
      }
      lose(err)
    })
  })
}

/** 单个检索词：缓存 → 限流 → 并发控制 → 已知可用的通道 */
async function itunesSearch(term, limit) {
  const key = `${term}|${limit}`
  const cached = itCacheGet(key)
  if (cached) return cached
  if (itRateLeft() <= 0) throw new Error('RATE')
  await itSlot()
  try {
    if (itRateLeft() <= 0) throw new Error('RATE')
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=HK&lang=zh_cn&media=music&entity=song&limit=${limit}`
    const data = await itNetwork(url)
    if (Array.isArray(data?.results) && data.results.length) itCacheSet(key, data)
    return data
  } finally {
    itRelease()
  }
}

/**
 * 6. 动态检索华语流行与网络热歌（Apple iTunes Search API — public-apis Music 分类）
 * 默认精准剔除纯音乐/伴奏/白噪音，并对同名曲目去重，保证歌单全为人声好歌
 */
export async function fetchWeatherMusic(queries, limitPerQuery = 7, { allowInstrumental = false } = {}) {
  const validQueries = (Array.isArray(queries) ? queries : [queries]).filter(Boolean)
  if (!validQueries.length) return []

  let settled = await Promise.allSettled(validQueries.map((term) => itunesSearch(term, limitPerQuery)))
  // 全部失败且不是因为限流：稍等后只用前两个检索词再试一次（偶发超时很常见）
  if (settled.every((r) => r.status === 'rejected') && settled.some((r) => r.reason?.message !== 'RATE')) {
    await new Promise((r) => setTimeout(r, 1500))
    settled = await Promise.allSettled(validQueries.slice(0, 2).map((term) => itunesSearch(term, limitPerQuery)))
  }
  const tracks = []
  const seenIds = new Set()
  const seenSongKeys = new Set()
  const bgmFilter = /(纯音乐|純音樂|轻音乐|輕音樂|伴奏|白噪音|睡眠|冥想|Instrumental|Karaoke|Backing|DJ版|纯钢琴|純鋼琴)/i

  for (const item of settled) {
    if (item.status === 'fulfilled' && Array.isArray(item.value?.results)) {
      for (const raw of item.value.results) {
        if (!raw.previewUrl || seenIds.has(raw.trackId)) continue

        const combinedText = `${raw.trackName || ''} ${raw.artistName || ''} ${raw.collectionName || ''} ${raw.primaryGenreName || ''}`
        if (!allowInstrumental && bgmFilter.test(combinedText)) {
          continue
        }

        // 归一化歌名去重（避免同一首歌普通版、Live版连续重复霸屏）
        const normTitle = (raw.trackName || '')
          .replace(/\s*[\(（\[【].*?[\)）\]】]/g, '')
          .trim()
          .toLowerCase()
        const normArtist = (raw.artistName || '').slice(0, 6).toLowerCase()
        const songKey = `${normTitle}::${normArtist}`
        if (seenSongKeys.has(songKey)) continue

        seenIds.add(raw.trackId)
        seenSongKeys.add(songKey)

        tracks.push({
          id: raw.trackId,
          title: raw.trackName || '未知曲目',
          artist: raw.artistName || '未知音乐人',
          album: raw.collectionName || '单曲发行',
          genre: raw.primaryGenreName || '华语流行',
          releaseYear: raw.releaseDate ? raw.releaseDate.slice(0, 4) : '',
          durationMs: raw.trackTimeMillis || 30000,
          previewUrl: raw.previewUrl,
          isLiveStream: false,
          coverSm: raw.artworkUrl100 || '',
          coverLg: raw.artworkUrl100
            ? raw.artworkUrl100.replace('100x100bb', '600x600bb')
            : '',
          storeUrl: raw.trackViewUrl || ''
        })
      }
    }
  }

  if (tracks.length > 0) {
    return tracks.slice(0, 16)
  }

  // iTunes 全部超时/被拦截时，自动切换至备用曲库 Deezer API（public-apis Music 分类，MP3 试听流）
  try {
    const backup = await fetchDeezerMusic(validQueries, allowInstrumental)
    if (backup.length > 0) return backup
  } catch {
    // 继续向上抛出统一错误
  }

  if (settled.every((s) => s.status === 'rejected')) {
    const reason = classifyError(settled[0].reason)
    const err = new Error(`iTunes 曲库${reason}，备用的 Deezer 也没有响应`)
    err.reason = reason
    throw err
  }
  return []
}

/**
 * 7. 备用曲库：Deezer API（public-apis Music 分类，公开搜索接口无需登录）
 * 支持 JSONP（output=jsonp），试听流为标准 MP3，所有浏览器均可原生播放
 */
async function fetchDeezerMusic(queries, allowInstrumental = false) {
  const bgmFilter = /(纯音乐|純音樂|轻音乐|輕音樂|伴奏|白噪音|睡眠|冥想|Instrumental|Karaoke|Backing)/i
  const tasks = queries.slice(0, 4).map((term) => {
    const base = `https://api.deezer.com/search?q=${encodeURIComponent(term)}&limit=6`
    if (typeof document === 'undefined') return fetchJsonWithTimeout(base, 10000)
    return fetchJsonp(`${base}&output=jsonp`, 10000)
  })
  const settled = await Promise.allSettled(tasks)
  const seen = new Set()
  const tracks = []
  for (const item of settled) {
    if (item.status !== 'fulfilled' || !Array.isArray(item.value?.data)) continue
    for (const raw of item.value.data) {
      if (!raw.preview || seen.has(raw.id)) continue
      const text = `${raw.title || ''} ${raw.artist?.name || ''} ${raw.album?.title || ''}`
      if (!allowInstrumental && bgmFilter.test(text)) continue
      seen.add(raw.id)
      tracks.push({
        id: `dz-${raw.id}`,
        title: raw.title || '未知曲目',
        artist: raw.artist?.name || '未知音乐人',
        album: raw.album?.title || '单曲发行',
        genre: 'Deezer 备用曲库',
        releaseYear: '',
        durationMs: 30000,
        previewUrl: raw.preview,
        isLiveStream: false,
        directPlay: true,
        coverSm: raw.album?.cover_small || raw.album?.cover_medium || '',
        coverLg: raw.album?.cover_big || raw.album?.cover_medium || '',
        storeUrl: raw.link || ''
      })
    }
  }
  return tracks.slice(0, 16)
}
