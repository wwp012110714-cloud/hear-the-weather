/**
 * 公共 API 数据服务层
 * 严格采用 GitHub public-apis/public-apis 官方收录且支持国内直连与浏览器 CORS 跨域的免费公共接口：
 * 1. Open-Meteo API (Weather & Environment 分类) — 城市中文检索、实时气象、7日预报与 PM2.5/AQI 空气质量
 * 2. Meteorologisk Institutt / MET Norway API (Weather 分类) — 全球高精度气象实时观测与多日预报（双源竞速容灾）
 * 3. Apple iTunes Search API (Music 分类) — 华语与氛围音乐检索、高清黑胶封面及正版 AAC 音频试听流
 * 4. Hong Kong Observatory Open Data API (Weather 分类) — 中国传统农历干支与节令日期
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
 * 将 MET Norway symbol_code 归一化为标准 WMO 天气代码与昼夜标记
 */
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

/**
 * 根据纬度、经度与日期计算北京时间（UTC+8）日出与日落时刻
 */
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

/**
 * 将 ISO UTC 时间转为北京时间 YYYY-MM-DDTHH:mm
 */
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
 * 2. 批量拉取顶栏漫游城市的实时温度与天气状态（Open-Meteo 与 MET Norway 并发竞速）
 */
export async function fetchBatchCityWeather(cities) {
  if (!cities?.length) return {}

  const openMeteoJob = (async () => {
    const lats = cities.map((c) => c.lat).join(',')
    const lons = cities.map((c) => c.lon).join(',')
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,weather_code,is_day&timezone=Asia%2FShanghai`
    const data = await fetchJsonWithTimeout(url, 4500)
    const list = Array.isArray(data) ? data : [data]
    const result = {}
    cities.forEach((city, idx) => {
      const cur = list[idx]?.current
      if (cur) {
        result[city.id] = {
          temp: Math.round(cur.temperature_2m),
          code: cur.weather_code,
          isDay: cur.is_day
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
          fallback[city.id] = {
            temp: Math.round(temp),
            code: parsed.code,
            isDay: parsed.isDay
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

/**
 * 内部：通过 Open-Meteo 获取完整单城预报
 */
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

/**
 * 内部：通过 MET Norway (api.met.no) 获取完整单城预报（毫秒级响应双源保障）
 */
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

  // 组装未来 24 小时逐时曲线
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

  // 按北京日期聚合未来 7 天趋势
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
 * 3. 拉取选定城市的完整实时气象、24小时逐时曲线、7天趋势与空气质量
 * 采用双公共气象源竞速机制（Promise.any），确保任意网络环境下均毫秒级出数
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
 * 5. 动态检索音乐歌单（Apple iTunes Search API）
 */
export async function fetchWeatherMusic(queries, limitPerQuery = 10) {
  const validQueries = (Array.isArray(queries) ? queries : [queries]).filter(Boolean)
  if (!validQueries.length) return []

  const tasks = validQueries.map((term) => {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=HK&lang=zh_cn&media=music&entity=song&limit=${limitPerQuery}`
    return fetchJsonWithTimeout(url, 9000)
  })

  const settled = await Promise.allSettled(tasks)
  const tracks = []
  const seenIds = new Set()

  for (const item of settled) {
    if (item.status === 'fulfilled' && Array.isArray(item.value?.results)) {
      for (const raw of item.value.results) {
        if (!raw.previewUrl || seenIds.has(raw.trackId)) continue
        seenIds.add(raw.trackId)
        tracks.push({
          id: raw.trackId,
          title: raw.trackName || '未知曲目',
          artist: raw.artistName || '未知音乐人',
          album: raw.collectionName || '单曲发行',
          genre: raw.primaryGenreName || '华语音乐',
          releaseYear: raw.releaseDate ? raw.releaseDate.slice(0, 4) : '',
          durationMs: raw.trackTimeMillis || 30000,
          previewUrl: raw.previewUrl,
          coverSm: raw.artworkUrl100 || '',
          coverLg: raw.artworkUrl100
            ? raw.artworkUrl100.replace('100x100bb', '600x600bb')
            : '',
          storeUrl: raw.trackViewUrl || ''
        })
      }
    }
  }

  if (tracks.length === 0 && settled.every((s) => s.status === 'rejected')) {
    throw new Error('音乐电台接口响应超时，请稍后重试')
  }

  return tracks.slice(0, 16)
}
