import { getWeatherMeta, getWindDirectionLabel, getAqiMeta } from './weatherMap'
import { beaufort } from './chart'

/** 把接口返回的完整气象数据整理成图面上要填写的读数 */
export function buildReadings(weather) {
  if (!weather?.current) return null
  const c = weather.current
  const today = weather.daily7?.[0]
  const meta = getWeatherMeta(c.code, c.isDay, c.temp)
  const aqi = weather.airQuality?.aqi
  const aqiMeta = getAqiMeta(aqi)
  const bf = beaufort(c.windSpeed ?? 0)
  return {
    code: c.code,
    isDay: c.isDay,
    short: meta.short,
    label: meta.label,
    temp: c.temp,
    tempInt: Math.round(c.temp),
    feels: Number.isFinite(c.apparentTemp) ? Math.round(c.apparentTemp) : null,
    range: today ? `${Math.round(today.minTemp)}°～${Math.round(today.maxTemp)}°` : '',
    min: today ? Math.round(today.minTemp) : null,
    max: today ? Math.round(today.maxTemp) : null,
    windDir: getWindDirectionLabel(c.windDirection ?? 0),
    windSpeed: c.windSpeed,
    windDirection: c.windDirection,
    windText: `${getWindDirectionLabel(c.windDirection ?? 0)} ${bf}级 · ${Math.round(c.windSpeed ?? 0)} km/h`,
    humidity: c.humidity,
    cloudCover: c.cloudCover,
    pressure: c.pressure,
    aqi: Number.isFinite(aqi) ? Math.round(aqi) : null,
    aqiLabel: aqiMeta.label,
    aqiPoor: aqiMeta.level === 'poor' || aqiMeta.level === 'moderate',
    sunrise: today?.sunrise || '',
    sunset: today?.sunset || '',
    pop: today?.popMax ?? null,
    obsTime: weather.observationTime || '',
    provider: weather.provider || ''
  }
}
