/**
 * 公共 API 数据服务层
 * 严格使用 GitHub public-apis/public-apis 官方收录且支持国内直连与 CORS 跨域的免费公共接口：
 * 1. Open-Meteo API (Weather & Environment 分类) — 城市中文检索、实时气象、7日预报与空气质量
 * 2. Apple iTunes Search API (Music 分类) — 华语与氛围音乐检索、高清专辑封面及正版音频试听流
 * 3. Hong Kong Observatory Open Data API (Weather 分类) — 中国传统农历干支与节令日期
 */

async function fetchJsonWithTimeout(url, timeoutMs = 10000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 1. 中文城市地理编码搜索（Open-Meteo Geocoding API）
 * 针对「大理 / 大理市」等简称做双路并发归一化，优先排列中国行政城市结果
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
        8000
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
 * 2. 批量拉取顶栏漫游城市的实时温度与天气状态（单次合并请求）
 */
export async function fetchBatchCityWeather(cities) {
  if (!cities?.length) return {}
  const lats = cities.map((c) => c.lat).join(',')
  const lons = cities.map((c) => c.lon).join(',')
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,weather_code,is_day&timezone=Asia%2FShanghai`

  const data = await fetchJsonWithTimeout(url, 10000)
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

  return result
}

/**
 * 3. 拉取选定城市的完整实时气象、24小时逐时曲线、7天趋势与空气质量
 */
export async function fetchCityFullWeather(lat, lon) {
  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m` +
    `&hourly=temperature_2m,precipitation_probability,weather_code,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,wind_speed_10m_max` +
    `&timezone=Asia%2FShanghai&forecast_days=7`

  const aqiUrl =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
    `&current=pm10,pm2_5,us_aqi&timezone=Asia%2FShanghai`

  const [weatherRes, aqiRes] = await Promise.allSettled([
    fetchJsonWithTimeout(weatherUrl, 11000),
    fetchJsonWithTimeout(aqiUrl, 8000)
  ])

  if (weatherRes.status !== 'fulfilled') {
    throw new Error(weatherRes.reason?.message || '气象服务连接超时')
  }

  const w = weatherRes.value
  const aqiData = aqiRes.status === 'fulfilled' ? aqiRes.value?.current : null

  // 截取从当前小时开始的未来 24 小时逐时预报
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
    elevation: w.elevation ?? null,
    observationTime: w.current?.time?.slice(11, 16) || '',
    current: {
      temp: w.current.temperature_2m,
      apparentTemp: w.current.apparent_temperature,
      humidity: w.current.relative_humidity_2m,
      isDay: w.current.is_day,
      precipitation: w.current.precipitation ?? 0,
      code: w.current.weather_code,
      cloudCover: w.current.cloud_cover ?? 0,
      pressure: Math.round(w.current.surface_pressure ?? 1013),
      windSpeed: w.current.wind_speed_10m,
      windDirection: w.current.wind_direction_10m
    },
    airQuality: aqiData
      ? {
          aqi: aqiData.us_aqi,
          pm25: aqiData.pm2_5,
          pm10: aqiData.pm10
        }
      : null,
    hourly24,
    daily7
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
  const data = await fetchJsonWithTimeout(url, 7000)
  if (data?.LunarYear && data?.LunarDate) {
    const yearClean = data.LunarYear.replace('，', '·')
    return `${yearClean} ${data.LunarDate}`
  }
  return ''
}

/**
 * 5. 动态检索音乐歌单（Apple iTunes Search API）
 * 支持并发多词融合去重，返回高清黑胶封面与正版 30s AAC 试听流
 */
export async function fetchWeatherMusic(queries, limitPerQuery = 10) {
  const validQueries = (Array.isArray(queries) ? queries : [queries]).filter(Boolean)
  if (!validQueries.length) return []

  const tasks = validQueries.map((term) => {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=HK&lang=zh_cn&media=music&entity=song&limit=${limitPerQuery}`
    return fetchJsonWithTimeout(url, 10000)
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
