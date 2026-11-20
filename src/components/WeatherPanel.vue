<template>
  <section class="weather-panel glass-panel" aria-label="城市实时气象面板">
    <!-- 初次加载骨架屏 -->
    <div v-if="loading && !weather" class="weather-skeleton">
      <div class="skeleton-block" style="height: 28px; width: 55%"></div>
      <div class="skeleton-block" style="height: 92px; width: 100%; margin-top: 16px"></div>
      <div class="skeleton-block" style="height: 52px; width: 100%; margin-top: 14px"></div>
      <div class="skeleton-grid">
        <div v-for="n in 6" :key="n" class="skeleton-block" style="height: 74px"></div>
      </div>
      <div class="skeleton-block" style="height: 168px; width: 100%; margin-top: 16px"></div>
    </div>

    <!-- 加载失败友好提示 -->
    <div v-else-if="error && !weather" class="state-card error-card">
      <div class="state-title">气象站数据暂时未能送达</div>
      <p class="state-desc">{{ error }}</p>
      <button type="button" class="retry-btn" @click="$emit('retry')">重新连接气象接口</button>
    </div>

    <!-- 正常气象内容 -->
    <div v-else-if="weather" class="weather-body" :class="{ 'is-refreshing': loading }">
      <!-- 预报试听提示横幅 -->
      <div v-if="previewDay" class="preview-banner">
        <span>
          正在穿越试听 <strong>{{ previewDay.dayLabel }}（{{ previewDay.shortDate }}）</strong> 预报天气声景
        </span>
        <button type="button" class="reset-live-btn" @click="$emit('select-day', null)">
          返回此刻实时
        </button>
      </div>

      <!-- 城市与观测信息头 -->
      <div class="city-head">
        <div>
          <div class="city-title-line">
            <h2 class="city-heading">{{ city.name }}</h2>
            <span v-if="city.region" class="region-tag">{{ city.region }}</span>
            <span class="day-night-tag">
              {{ activeDisplay.isDay ? '白昼实时' : '星夜实时' }}
            </span>
          </div>
          <p class="coords-line tabular-nums">
            {{ city.lat.toFixed(2) }}°N · {{ city.lon.toFixed(2) }}°E
            <template v-if="weather.elevation != null"> · 海拔 {{ Math.round(weather.elevation) }}m</template>
            <template v-if="weather.observationTime"> · 更新于 {{ weather.observationTime }}</template>
          </p>
        </div>

        <button
          type="button"
          class="refresh-icon-btn"
          :disabled="loading"
          title="刷新实时气象数据"
          @click="$emit('retry')"
        >
          <svg :class="{ spinning: loading }" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M20 11A8 8 0 1 0 21.4 15.5M20 4V11H13"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>

      <!-- 核心大号温度与天象区 -->
      <div class="hero-weather-row">
        <div class="temp-block">
          <div class="giant-temp tabular-nums">
            {{ Math.round(activeDisplay.temp) }}<span class="deg-unit">°C</span>
          </div>
          <div class="condition-line">
            <span class="condition-label">{{ activeMeta.label }}</span>
            <span v-if="todayForecast" class="hl-range tabular-nums">
              {{ Math.round(todayForecast.minTemp) }}° ~ {{ Math.round(todayForecast.maxTemp) }}°
            </span>
          </div>
          <div class="apparent-line tabular-nums">
            体感 {{ activeDisplay.apparentTemp.toFixed(1) }}°C · 风向 {{ windDirText }}
          </div>
        </div>

        <div class="hero-icon-wrap">
          <WeatherIcon :type="activeMeta.icon" :size="86" />
        </div>
      </div>

      <!-- 诗意实时天气解读 -->
      <div class="poetic-quote">
        <span class="quote-mark">“</span>
        <p>{{ poeticText }}</p>
      </div>

      <!-- 六宫格气象与环境指标 -->
      <div class="metrics-grid">
        <div class="metric-card">
          <span class="metric-label">空气质量 AQI</span>
          <div class="metric-value-row">
            <strong class="metric-val tabular-nums">
              {{ weather.airQuality?.aqi ?? '--' }}
            </strong>
            <span class="aqi-badge" :class="`aqi-${aqiInfo.level}`">{{ aqiInfo.label }}</span>
          </div>
          <span class="metric-sub tabular-nums">
            PM2.5 {{ weather.airQuality?.pm25 != null ? `${weather.airQuality.pm25} μg/m³` : '监测中' }}
          </span>
        </div>

        <div class="metric-card">
          <span class="metric-label">实时风况</span>
          <div class="metric-value-row">
            <strong class="metric-val tabular-nums">{{ activeDisplay.windSpeed }}</strong>
            <span class="metric-unit">km/h</span>
          </div>
          <span class="metric-sub">{{ windDirText }} · {{ activeDisplay.windSpeed >= 20 ? '海陆劲风' : '微风轻拂' }}</span>
        </div>

        <div class="metric-card">
          <span class="metric-label">相对湿度 & 云量</span>
          <div class="metric-value-row">
            <strong class="metric-val tabular-nums">{{ weather.current.humidity }}</strong>
            <span class="metric-unit">%</span>
          </div>
          <span class="metric-sub tabular-nums">天空云量 {{ weather.current.cloudCover }}%</span>
        </div>

        <div class="metric-card">
          <span class="metric-label">紫外线指数</span>
          <div class="metric-value-row">
            <strong class="metric-val tabular-nums">{{ (todayForecast?.uvMax ?? 0).toFixed(1) }}</strong>
            <span class="metric-unit">{{ uvInfo.label }}</span>
          </div>
          <span class="metric-sub">{{ uvInfo.tip }}</span>
        </div>

        <div class="metric-card">
          <span class="metric-label">气压与降水</span>
          <div class="metric-value-row">
            <strong class="metric-val tabular-nums">{{ weather.current.pressure }}</strong>
            <span class="metric-unit">hPa</span>
          </div>
          <span class="metric-sub tabular-nums">当前降水量 {{ weather.current.precipitation }} mm</span>
        </div>

        <div class="metric-card">
          <span class="metric-label">日出与日落</span>
          <div class="sun-times tabular-nums">
            <span>日出 {{ todayForecast?.sunrise || '06:30' }}</span>
            <span>日落 {{ todayForecast?.sunset || '18:00' }}</span>
          </div>
          <div class="sun-bar-track" title="今日昼夜节律进度">
            <div class="sun-bar-fill" :style="{ width: `${dayProgress}%` }"></div>
          </div>
        </div>
      </div>

      <!-- 24小时逐时曲线 / 未来7天预报切换 -->
      <div class="forecast-section">
        <div class="forecast-tabs">
          <button
            type="button"
            class="tab-btn"
            :class="{ active: forecastTab === 'hourly' }"
            @click="forecastTab = 'hourly'"
          >
            24 小时逐时曲线
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: forecastTab === 'daily' }"
            @click="forecastTab = 'daily'"
          >
            未来 7 天趋势（点击可试听）
          </button>
        </div>

        <!-- 24小时 SVG 折线与逐时列表 -->
        <div v-if="forecastTab === 'hourly'" class="hourly-box">
          <svg
            v-if="chartPoints.length > 1"
            viewBox="0 0 520 96"
            class="hourly-svg"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="tempAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.34" />
                <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path :d="chartAreaPath" fill="url(#tempAreaGrad)" />
            <path :d="chartLinePath" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round" />
            <g v-for="(pt, idx) in chartPoints" :key="idx">
              <circle :cx="pt.x" :cy="pt.y" r="3.4" fill="#F8FAFC" stroke="var(--accent)" stroke-width="2" />
            </g>
          </svg>

          <div class="hourly-strip">
            <div
              v-for="(h, idx) in sampledHourly"
              :key="idx"
              class="hour-cell"
            >
              <span class="hour-time tabular-nums">{{ h.hourLabel }}</span>
              <WeatherIcon :type="getHourIcon(h)" :size="22" />
              <strong class="hour-temp tabular-nums">{{ Math.round(h.temp) }}°</strong>
              <span v-if="h.pop >= 15" class="hour-pop tabular-nums">{{ h.pop }}%雨</span>
              <span v-else class="hour-pop-muted">微风</span>
            </div>
          </div>
        </div>

        <!-- 7天趋势条（支持点击任一天穿越试听该日天气音乐） -->
        <div v-else class="daily-list">
          <button
            v-for="(d, idx) in weather.daily7"
            :key="d.date"
            type="button"
            class="daily-row"
            :class="{ selected: selectedDayIndex === idx }"
            @click="$emit('select-day', selectedDayIndex === idx ? null : idx)"
          >
            <div class="daily-left">
              <span class="daily-name">{{ d.dayLabel }}</span>
              <span class="daily-date tabular-nums">{{ d.shortDate }}</span>
            </div>

            <div class="daily-mid">
              <WeatherIcon :type="getDailyIcon(d)" :size="22" />
              <span class="daily-short">{{ getDailyLabel(d) }}</span>
              <span v-if="d.popMax >= 20" class="daily-pop tabular-nums">{{ d.popMax }}%</span>
            </div>

            <div class="daily-bar-wrap">
              <span class="min-t tabular-nums">{{ Math.round(d.minTemp) }}°</span>
              <div class="range-track">
                <div class="range-fill" :style="getRangeStyle(d)"></div>
              </div>
              <span class="max-t tabular-nums">{{ Math.round(d.maxTemp) }}°</span>
            </div>

            <span class="listen-day-tag">
              {{ selectedDayIndex === idx ? '试听中' : '听这天' }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue'
import WeatherIcon from './WeatherIcon.vue'
import {
  getWeatherMeta,
  getWindDirectionLabel,
  getAqiMeta,
  getUvMeta,
  buildPoeticSummary
} from '../utils/weatherMap'

const props = defineProps({
  city: {
    type: Object,
    required: true
  },
  weather: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ''
  },
  selectedDayIndex: {
    type: Number,
    default: null
  }
})

defineEmits(['retry', 'select-day'])

const forecastTab = ref('hourly')

const previewDay = computed(() => {
  if (props.selectedDayIndex == null || !props.weather?.daily7) return null
  return props.weather.daily7[props.selectedDayIndex] || null
})

const activeDisplay = computed(() => {
  if (!props.weather) {
    return { temp: 18, apparentTemp: 18, code: 0, isDay: 1, windSpeed: 5 }
  }
  if (previewDay.value) {
    const avgTemp = (previewDay.value.maxTemp + previewDay.value.minTemp) / 2
    return {
      temp: avgTemp,
      apparentTemp: avgTemp,
      code: previewDay.value.code,
      isDay: 1,
      windSpeed: previewDay.value.windMax
    }
  }
  return props.weather.current
})

const activeMeta = computed(() =>
  getWeatherMeta(activeDisplay.value.code, activeDisplay.value.isDay, activeDisplay.value.temp)
)

const todayForecast = computed(() => {
  if (previewDay.value) return previewDay.value
  return props.weather?.daily7?.[0] || null
})

const windDirText = computed(() =>
  getWindDirectionLabel(props.weather?.current?.windDirection ?? 0)
)

const aqiInfo = computed(() => getAqiMeta(props.weather?.airQuality?.aqi))
const uvInfo = computed(() => getUvMeta(todayForecast.value?.uvMax ?? 0))

const poeticText = computed(() => {
  if (!props.weather) return ''
  return buildPoeticSummary({
    cityName: props.city.name,
    code: activeDisplay.value.code,
    isDay: activeDisplay.value.isDay,
    temp: activeDisplay.value.temp,
    windSpeed: activeDisplay.value.windSpeed,
    humidity: props.weather.current.humidity
  })
})

const dayProgress = computed(() => {
  const sr = todayForecast.value?.sunrise || '06:30'
  const ss = todayForecast.value?.sunset || '18:00'
  const toMin = (str) => {
    const [h, m] = str.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }
  const now = new Date()
  const curMin = now.getHours() * 60 + now.getMinutes()
  const start = toMin(sr)
  const end = toMin(ss)
  if (end <= start) return 50
  const pct = ((curMin - start) / (end - start)) * 100
  return Math.max(6, Math.min(96, Math.round(pct)))
})

// 采样 8 个节点绘制清晰的 24 小时温度折线
const sampledHourly = computed(() => {
  const list = props.weather?.hourly24 || []
  return list.filter((_, i) => i % 3 === 0).slice(0, 8)
})

const chartPoints = computed(() => {
  const list = sampledHourly.value
  if (list.length < 2) return []
  const temps = list.map((h) => h.temp)
  const minT = Math.min(...temps)
  const maxT = Math.max(...temps)
  const span = Math.max(maxT - minT, 2)

  return list.map((h, i) => {
    const x = 24 + (i / (list.length - 1)) * 472
    const y = 74 - ((h.temp - minT) / span) * 52
    return { x, y, temp: h.temp }
  })
})

const chartLinePath = computed(() => {
  const pts = chartPoints.value
  if (!pts.length) return ''
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
})

const chartAreaPath = computed(() => {
  const pts = chartPoints.value
  if (!pts.length) return ''
  const first = pts[0]
  const last = pts[pts.length - 1]
  return `${chartLinePath.value} L ${last.x.toFixed(1)} 92 L ${first.x.toFixed(1)} 92 Z`
})

const weekBounds = computed(() => {
  const days = props.weather?.daily7 || []
  if (!days.length) return { min: 0, max: 25 }
  return {
    min: Math.min(...days.map((d) => d.minTemp)),
    max: Math.max(...days.map((d) => d.maxTemp))
  }
})

function getRangeStyle(day) {
  const { min, max } = weekBounds.value
  const span = Math.max(max - min, 1)
  const left = ((day.minTemp - min) / span) * 100
  const width = Math.max(10, ((day.maxTemp - day.minTemp) / span) * 100)
  return {
    left: `${left}%`,
    width: `${width}%`
  }
}

function getHourIcon(h) {
  return getWeatherMeta(h.code, h.isDay, h.temp).icon
}

function getDailyIcon(d) {
  return getWeatherMeta(d.code, 1, d.maxTemp).icon
}

function getDailyLabel(d) {
  return getWeatherMeta(d.code, 1, d.maxTemp).short
}
</script>

<style scoped>
.weather-panel {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.weather-body.is-refreshing {
  opacity: 0.78;
  transition: opacity 0.25s;
}

.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 14px;
}

.state-card {
  padding: 36px 20px;
  text-align: center;
}

.state-title {
  font-size: 1.05rem;
  font-weight: 600;
}

.state-desc {
  margin: 8px 0 18px;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.retry-btn {
  padding: 8px 18px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent-border);
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 0.85rem;
  font-weight: 600;
}

.preview-banner {
  margin-bottom: 14px;
  padding: 8px 12px;
  border-radius: 12px;
  background: var(--accent-soft);
  border: 1px solid var(--accent-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 0.8rem;
  color: var(--accent-text);
}

.reset-live-btn {
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--accent-border);
  background: rgba(15, 23, 42, 0.55);
  color: var(--text-primary);
  font-size: 0.75rem;
  white-space: nowrap;
}

.city-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.city-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.city-heading {
  margin: 0;
  font-size: 1.55rem;
  font-weight: 700;
}

.region-tag,
.day-night-tag {
  font-size: 0.74rem;
  padding: 2px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
}

.day-night-tag {
  color: var(--accent-text);
  border-color: var(--accent-border);
  background: var(--accent-soft);
}

.coords-line {
  margin: 5px 0 0;
  font-size: 0.76rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.refresh-icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinning {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.hero-weather-row {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.giant-temp {
  font-size: 3.9rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
}

.deg-unit {
  font-size: 1.5rem;
  font-weight: 500;
  margin-left: 2px;
  color: var(--text-secondary);
}

.condition-line {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.condition-label {
  font-size: 1.05rem;
  font-weight: 600;
}

.hl-range {
  font-size: 0.88rem;
  color: var(--text-secondary);
}

.apparent-line {
  margin-top: 4px;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.poetic-quote {
  margin-top: 14px;
  padding: 11px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.055);
  border-left: 3px solid var(--accent);
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.quote-mark {
  font-family: var(--font-serif);
  font-size: 1.4rem;
  line-height: 1;
  color: var(--accent);
}

.poetic-quote p {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.55;
  color: var(--text-secondary);
}

.metrics-grid {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.metric-card {
  padding: 11px 13px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric-label {
  font-size: 0.74rem;
  color: var(--text-muted);
}

.metric-value-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.metric-val {
  font-size: 1.2rem;
  font-weight: 700;
}

.metric-unit {
  font-size: 0.76rem;
  color: var(--text-secondary);
}

.metric-sub {
  font-size: 0.73rem;
  color: var(--text-secondary);
}

.aqi-badge {
  font-size: 0.7rem;
  padding: 1px 7px;
  border-radius: 999px;
  font-weight: 600;
}

.aqi-good {
  background: rgba(52, 211, 153, 0.2);
  color: #6ee7b7;
}

.aqi-fair {
  background: rgba(251, 191, 36, 0.2);
  color: #fde68a;
}

.aqi-moderate,
.aqi-poor {
  background: rgba(251, 113, 133, 0.22);
  color: #fda4af;
}

.aqi-neutral {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-secondary);
}

.sun-times {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  font-weight: 600;
  margin-top: 2px;
}

.sun-bar-track {
  margin-top: 6px;
  height: 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
}

.sun-bar-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #38bdf8, #fbbf24);
}

.forecast-section {
  margin-top: 18px;
  padding-top: 15px;
  border-top: 1px solid var(--border-subtle);
}

.forecast-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.tab-btn {
  flex: 1;
  padding: 7px 10px;
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.04);
  font-size: 0.79rem;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.tab-btn.active {
  background: var(--accent-soft);
  border-color: var(--accent-border);
  color: var(--accent-text);
  font-weight: 600;
}

.hourly-box {
  background: rgba(7, 13, 24, 0.34);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 14px;
  padding: 12px 10px;
}

.hourly-svg {
  width: 100%;
  height: 76px;
  display: block;
}

.hourly-strip {
  margin-top: 6px;
  display: grid;
  grid-template-columns: repeat(8, minmax(46px, 1fr));
  gap: 4px;
  overflow-x: auto;
}

.hour-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  text-align: center;
}

.hour-time {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.hour-temp {
  font-size: 0.82rem;
}

.hour-pop {
  font-size: 0.66rem;
  color: #7dd3fc;
}

.hour-pop-muted {
  font-size: 0.66rem;
  color: var(--text-muted);
}

.daily-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.daily-row {
  width: 100%;
  padding: 8px 10px;
  border-radius: 11px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.035);
  display: grid;
  grid-template-columns: 74px 96px 1fr auto;
  align-items: center;
  gap: 8px;
  text-align: left;
  transition: all 0.18s;
}

.daily-row:hover {
  background: rgba(255, 255, 255, 0.09);
}

.daily-row.selected {
  border-color: var(--accent-border);
  background: var(--accent-soft);
}

.daily-left {
  display: flex;
  align-items: baseline;
  gap: 5px;
}

.daily-name {
  font-size: 0.83rem;
  font-weight: 600;
}

.daily-date {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.daily-mid {
  display: flex;
  align-items: center;
  gap: 5px;
}

.daily-short {
  font-size: 0.76rem;
  color: var(--text-secondary);
}

.daily-pop {
  font-size: 0.68rem;
  color: #7dd3fc;
}

.daily-bar-wrap {
  display: flex;
  align-items: center;
  gap: 7px;
}

.min-t,
.max-t {
  font-size: 0.77rem;
  width: 28px;
}

.min-t {
  color: var(--text-muted);
  text-align: right;
}

.range-track {
  position: relative;
  flex: 1;
  height: 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
}

.range-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: 999px;
  background: linear-gradient(90deg, #38bdf8, var(--accent));
}

.listen-day-tag {
  font-size: 0.68rem;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
}

.daily-row.selected .listen-day-tag {
  background: var(--accent);
  color: #0f172a;
  font-weight: 700;
}

@media (max-width: 560px) {
  .daily-row {
    grid-template-columns: 68px 82px 1fr;
  }
  .listen-day-tag {
    display: none;
  }
}
</style>
