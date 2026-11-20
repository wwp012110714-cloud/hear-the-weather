<template>
  <div class="view-station" :class="{ compact }">
    <div ref="stage" class="stage">
      <svg
        class="glyph-svg"
        :width="sw"
        :height="sh"
        :viewBox="`0 0 ${sw} ${sh}`"
        role="img"
        :aria-label="ariaGlyph"
      >
        <g class="graticule" aria-hidden="true">
          <line v-for="gx in gridX" :key="'x' + gx" :x1="gx" :x2="gx" y1="0" :y2="sh" />
          <line v-for="gy in gridY" :key="'y' + gy" x1="0" :x2="sw" :y1="gy" :y2="gy" />
        </g>

        <template v-if="r">
          <!-- 风杆 -->
          <g v-if="barb && !barb.calm" class="big-barb" :transform="`translate(${cx} ${cy})`">
            <line :x1="barb.shaft[0]" :y1="barb.shaft[1]" :x2="barb.shaft[2]" :y2="barb.shaft[3]" />
            <line v-for="(b, i) in barb.barbs" :key="i" :x1="b[0]" :y1="b[1]" :x2="b[2]" :y2="b[3]" />
            <polygon v-for="(f, i) in barb.flags" :key="'f' + i" :points="f" />
          </g>

          <!-- 站圈 + 云量 -->
          <circle class="big-ring" :cx="cx" :cy="cy" :r="R" />
          <path v-if="coverPath" class="big-cover" :d="coverPath" />
          <circle class="big-mark" :cx="cx" :cy="cy" :r="R + 14" />

          <!-- 天气现象（左） -->
          <g v-if="ww" class="big-ww" :transform="`translate(${cx - R - R * 0.42} ${cy}) scale(${R / 30})`">
            <template v-if="ww === 'rain'">
              <circle cx="-3" cy="0" r="2" /><circle cx="3" cy="0" r="2" />
            </template>
            <path v-else-if="ww === 'snow'" d="M0 -5v10M-4.3 -2.5l8.6 5M-4.3 2.5l8.6 -5" class="s" />
            <path v-else-if="ww === 'fog'" d="M-6 -3.5h12M-6 0h12M-6 3.5h12" class="s" />
            <path v-else-if="ww === 'storm'" d="M-5 5v-10h9l-3.5 5h3.5l-5 6" class="s" />
            <template v-else-if="ww === 'shower'">
              <path d="M-4 -0.5h8L0 6z" class="s" /><circle cx="0" cy="-4" r="1.8" />
            </template>
            <path
              v-else-if="ww === 'drizzle'"
              d="M-3.4 -1.2a1.8 1.8 0 1 1 1.3 1.8l-1.6 2.6M3 -1.2a1.8 1.8 0 1 1 1.3 1.8l-1.6 2.6"
              class="s"
            />
          </g>

          <!-- 标准填图位置上的读数 -->
          <g class="readings">
            <text class="big-num num" :x="cx - R * 0.78" :y="cy - R * 1.05" text-anchor="end" :font-size="R * 0.78">
              {{ r.tempInt }}
            </text>
            <text class="big-num num" :x="cx + R * 0.78" :y="cy - R * 1.05" text-anchor="start" :font-size="R * 0.78">
              {{ r.pressure }}
            </text>
            <text class="big-num num" :x="cx - R * 0.78" :y="cy + R * 1.62" text-anchor="end" :font-size="R * 0.52">
              {{ r.humidity }}
            </text>
            <text
              v-if="r.feels != null"
              class="big-num num"
              :x="cx + R * 1.22"
              :y="cy + R * 0.2"
              text-anchor="start"
              :font-size="R * 0.36"
            >{{ r.feels }}°</text>
            <text class="big-num num" :x="cx + R * 0.1" :y="cy + R * 1.62" text-anchor="start" :font-size="R * 0.36">
              {{ r.cloudCover }}%
            </text>
          </g>

          <!-- 读数名称（细引线） -->
          <g class="callouts">
            <g v-for="c in callouts" :key="c.t">
              <polyline :points="c.line" />
              <text :x="c.tx" :y="c.ty" :text-anchor="c.anchor">{{ c.t }}</text>
            </g>
          </g>

          <!-- 风的文字读数 -->
          <text v-if="barbEnd" class="wind-text" :x="barbEnd.x" :y="barbEnd.y" :text-anchor="barbEnd.anchor">
            {{ r.windText }}
          </text>
        </template>
      </svg>

      <h2 class="st-city" :style="cityStyle">{{ city.name }}</h2>

      <div v-if="r" class="st-sub" :style="subStyle">
        <span>{{ r.label }}</span>
        <span v-if="r.range" class="num">{{ r.range }}</span>
        <span v-if="r.aqi != null" class="num" :class="{ strong: r.aqiPoor }">AQI {{ r.aqi }} {{ r.aqiLabel }}</span>
        <span v-if="r.sunrise" class="num">日出 {{ r.sunrise }} · 日落 {{ r.sunset }}</span>
      </div>
      <p v-else-if="error" class="st-state" :style="subStyle">
        {{ error }} <button type="button" class="chart-btn" @click="$emit('retry')">重新观测</button>
      </p>
      <p v-else class="st-state" :style="subStyle">观测中…</p>

      <!-- 「现在天气」栏位里的歌 -->
      <aside class="st-note" :style="noteStyle" aria-label="正在播放">
        <PlayerNote
          :favorite-ids="favoriteIds"
          :basis="basis"
          :loading="musicLoading"
          :error="musicError"
          :fallback-notice="fallbackNotice"
          @toggle-favorite="$emit('toggle-favorite', $event)"
          @retry="$emit('retry-music')"
        />
      </aside>
    </div>

    <!-- 右栏：测站索引 + 歌曲记录 -->
    <div class="side">
      <section class="index" aria-labelledby="idx-h">
        <h3 id="idx-h" class="side-h">测站索引</h3>
        <ul>
          <li v-for="st in indexRows" :key="st.city.id">
            <button
              type="button"
              class="idx-row"
              :class="{ active: st.selected }"
              :aria-pressed="String(st.selected)"
              @click="$emit('select-city', st.city)"
            >
              <svg width="34" height="30" viewBox="-17 -15 34 30" aria-hidden="true">
                <StationGlyph
                  :code="st.code"
                  :cloud-cover="st.cloudCover"
                  :wind-speed="st.windSpeed"
                  :wind-direction="st.windDirection"
                  :s="0.62"
                  :selected="st.selected"
                />
              </svg>
              <span class="idx-name">{{ st.city.name }}</span>
              <span class="idx-temp num">{{ st.temp != null ? Math.round(st.temp) + '°' : '—' }}</span>
              <span class="idx-short">{{ st.short }}</span>
            </button>
          </li>
        </ul>
      </section>
      <section class="log" aria-labelledby="log-h">
        <h3 id="log-h" class="side-h">歌曲记录</h3>
        <SongLog :tracks="tracks" :loading="musicLoading" :limit="6" />
      </section>
    </div>

    <div class="trace-strip">
      <span class="strip-label">未来 24 小时气温</span>
      <TempTrace :hourly="weather?.hourly24 || []" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import StationGlyph from './StationGlyph.vue'
import PlayerNote from './PlayerNote.vue'
import SongLog from './SongLog.vue'
import TempTrace from './TempTrace.vue'
import { useSize } from '../composables/useSize'
import { buildReadings } from '../utils/readings'
import { cloudOktas, presentWeather, windBarb } from '../utils/chart'
import { getWeatherMeta } from '../utils/weatherMap'

const props = defineProps({
  city: { type: Object, required: true },
  weather: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  stations: { type: Array, default: () => [] },
  tracks: { type: Array, default: () => [] },
  musicLoading: { type: Boolean, default: false },
  musicError: { type: String, default: '' },
  basis: { type: String, default: '' },
  favoriteIds: { type: Object, required: true },
  fallbackNotice: { type: String, default: '' },
  compact: { type: Boolean, default: false }
})

defineEmits(['select-city', 'toggle-favorite', 'retry', 'retry-music'])

const stage = ref(null)
const { width: sw, height: shRaw } = useSize(stage, { width: 1000, height: 620 })
const sh = computed(() => (props.compact ? 360 : shRaw.value))

const r = computed(() => buildReadings(props.weather))

const R = computed(() => {
  if (props.compact) return Math.round(Math.min(sw.value * 0.17, 74))
  return Math.round(Math.max(70, Math.min(sw.value * 0.115, sh.value * 0.17, 122)))
})
const cx = computed(() => (props.compact ? sw.value * 0.4 : Math.round(sw.value * 0.33)))
const cy = computed(() => (props.compact ? sh.value * 0.5 : Math.round(sh.value * 0.54)))

const gridX = computed(() => {
  const n = Math.max(5, Math.round(sw.value / 110))
  return Array.from({ length: n - 1 }, (_, i) => Math.round(((i + 1) * sw.value) / n) + 0.5)
})
const gridY = computed(() => {
  const n = Math.max(4, Math.round(sh.value / 110))
  return Array.from({ length: n - 1 }, (_, i) => Math.round(((i + 1) * sh.value) / n) + 0.5)
})

const oktas = computed(() => (r.value ? cloudOktas(r.value.code, r.value.cloudCover) : 0))
const ww = computed(() => (r.value ? presentWeather(r.value.code) : null))

const coverPath = computed(() => {
  const o = oktas.value
  if (!o || o === 9) return ''
  const f = Math.min(1, Math.round(o / 2) / 4)
  const rr = R.value
  if (f >= 1) {
    return `M${cx.value} ${cy.value - rr}A${rr} ${rr} 0 1 1 ${cx.value} ${cy.value + rr}A${rr} ${rr} 0 1 1 ${cx.value} ${cy.value - rr}Z`
  }
  const a = f * Math.PI * 2
  return `M${cx.value} ${cy.value}L${cx.value} ${cy.value - rr}A${rr} ${rr} 0 ${f > 0.5 ? 1 : 0} 1 ${(
    cx.value +
    Math.sin(a) * rr
  ).toFixed(1)} ${(cy.value - Math.cos(a) * rr).toFixed(1)}Z`
})

const barb = computed(() =>
  r.value ? windBarb(r.value.windSpeed, r.value.windDirection, R.value, R.value * 1.55, R.value * 0.5) : null
)

const barbEnd = computed(() => {
  const b = barb.value
  if (!b || b.calm) return null
  const x = cx.value + b.shaft[2]
  const y = cy.value + b.shaft[3]
  return { x: x + (b.shaft[2] >= 0 ? 10 : -10), y: y + (b.shaft[3] >= 0 ? 24 : -12), anchor: b.shaft[2] >= 0 ? 'start' : 'end' }
})

const callouts = computed(() => {
  const rr = R.value
  const c = cx.value
  const y = cy.value
  const fsTop = rr * 0.78
  return [
    {
      t: '气温 °C',
      line: `${c - rr * 0.78 - fsTop * 1.3},${y - rr * 1.05 - fsTop * 0.35} ${c - rr * 0.78 - fsTop * 1.55},${
        y - rr * 1.05 - fsTop * 0.35
      }`,
      tx: c - rr * 0.78 - fsTop * 1.62,
      ty: y - rr * 1.05 - fsTop * 0.35 + 4,
      anchor: 'end'
    },
    {
      t: '气压 hPa',
      line: `${c + rr * 0.78 + fsTop * 2.05},${y - rr * 1.05 - fsTop * 0.35} ${c + rr * 0.78 + fsTop * 2.3},${
        y - rr * 1.05 - fsTop * 0.35
      }`,
      tx: c + rr * 0.78 + fsTop * 2.37,
      ty: y - rr * 1.05 - fsTop * 0.35 + 4,
      anchor: 'start'
    },
    {
      t: '相对湿度 %',
      line: `${c - rr * 0.78 - rr * 0.95},${y + rr * 1.45} ${c - rr * 0.78 - rr * 1.15},${y + rr * 1.45}`,
      tx: c - rr * 0.78 - rr * 1.2,
      ty: y + rr * 1.45 + 4,
      anchor: 'end'
    },
    {
      t: '体感',
      line: `${c + rr * 1.22},${y + rr * 0.34} ${c + rr * 1.22},${y + rr * 0.5}`,
      tx: c + rr * 1.22,
      ty: y + rr * 0.68,
      anchor: 'start'
    },
    {
      t: '云量',
      line: `${c + rr * 0.1},${y + rr * 1.75} ${c + rr * 0.1},${y + rr * 1.9}`,
      tx: c + rr * 0.1,
      ty: y + rr * 2.06,
      anchor: 'start'
    }
  ]
})

const cityStyle = computed(() =>
  props.compact
    ? {}
    : { left: `${Math.round(cx.value - R.value * 2.2)}px`, top: '34px' }
)
const subStyle = computed(() =>
  props.compact ? {} : { left: `${Math.round(cx.value - R.value * 2.2)}px`, top: '128px' }
)
const noteStyle = computed(() => {
  if (props.compact) return {}
  const rr = R.value
  let left = Math.round(cx.value + rr * 2.0)
  const top = Math.round(cy.value - rr * 0.3)
  const b = barb.value
  if (b && !b.calm) {
    const ex = cx.value + b.shaft[2]
    const ey = cy.value + b.shaft[3]
    // 风杆末端落在批注框高度范围内时，批注框让到风杆右边
    if (ey > top - 20 && ey < top + 200 && ex + 24 > left) left = Math.round(ex + 40)
  }
  const w = Math.max(240, Math.min(310, sw.value - left - 28))
  left = Math.min(left, sw.value - w - 28)
  return { left: `${left}px`, top: `${top}px`, width: `${w}px` }
})

const indexRows = computed(() =>
  props.stations.map((s) => {
    const selected = s.city.id === props.city.id
    const cur = selected && props.weather?.current
    const snap = s.snap || {}
    const code = cur ? cur.code : snap.code ?? null
    const temp = cur ? cur.temp : snap.temp ?? null
    return {
      city: s.city,
      selected,
      code,
      temp,
      cloudCover: cur ? cur.cloudCover : snap.cloudCover ?? null,
      windSpeed: cur ? cur.windSpeed : snap.windSpeed ?? null,
      windDirection: cur ? cur.windDirection : snap.windDirection ?? null,
      short: code != null ? getWeatherMeta(code, cur ? cur.isDay : snap.isDay ?? 1, temp ?? 18).short : ''
    }
  })
)

const ariaGlyph = computed(() =>
  r.value
    ? `${props.city.name} 站点填图：气温 ${r.value.tempInt} 度，气压 ${r.value.pressure} 百帕，相对湿度 ${r.value.humidity}%，${r.value.windText}`
    : `${props.city.name} 站点填图`
)
</script>

<style scoped>
.view-station {
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 324px;
  grid-template-rows: minmax(0, 1fr) 78px;
}

.stage {
  position: relative;
  min-height: 0;
  overflow: hidden;
}

.glyph-svg {
  position: absolute;
  inset: 0;
  display: block;
}

.graticule line {
  stroke: var(--grid);
  stroke-width: 1;
}

.big-ring {
  fill: var(--paper);
  stroke: var(--ink);
  stroke-width: 3;
}

.big-cover {
  fill: var(--ink);
}

.big-mark {
  fill: none;
  stroke: var(--front);
  stroke-width: 1.4;
}

.big-barb line {
  stroke: var(--ink);
  stroke-width: 3;
  stroke-linecap: square;
}

.big-barb polygon {
  fill: var(--ink);
}

.big-ww circle {
  fill: var(--ink);
}

.big-ww .s {
  fill: none;
  stroke: var(--ink);
  stroke-width: 1.4;
}

.big-num {
  fill: var(--ink);
  font-family: var(--serif);
  letter-spacing: -0.02em;
}

.callouts polyline {
  fill: none;
  stroke: var(--ink-3);
  stroke-width: 1;
}

.callouts text {
  font-size: 13px;
  fill: var(--ink-3);
  font-family: var(--serif);
}

.wind-text {
  font-size: 14px;
  fill: var(--ink);
  font-family: var(--serif);
}

.st-city {
  position: absolute;
  margin: 0;
  font-size: clamp(3rem, 5vw, 4.75rem);
  line-height: 1;
  font-weight: 400;
  letter-spacing: 0.04em;
}

.st-sub,
.st-state {
  position: absolute;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
  font-size: 0.9375rem;
  color: var(--ink-2);
  max-width: 560px;
}

.st-sub .strong {
  font-weight: 700;
  color: var(--ink);
  text-decoration: underline;
  text-underline-offset: 4px;
}

.st-note {
  position: absolute;
  padding: 14px 16px 12px;
  background: var(--paper-lift);
  border: 1px solid var(--rule);
}

/* 右栏 */
.side {
  grid-row: 1 / 2;
  grid-column: 2;
  border-left: 1px solid var(--rule);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
}

.side-h {
  margin: 0;
  padding: 10px 16px 6px;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  border-bottom: 1px solid var(--rule);
}

.index ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.index li {
  border-bottom: 1px solid var(--rule-soft);
}

.idx-row {
  width: 100%;
  display: grid;
  grid-template-columns: 34px 1fr auto 3.6em;
  align-items: center;
  gap: 8px;
  padding: 3px 16px 3px 10px;
  text-align: left;
  font-size: 0.9375rem;
  transition: background-color var(--dur-fast) ease;
}

.idx-row:hover {
  background: rgba(44, 90, 138, 0.06);
}

.idx-row.active {
  color: var(--front);
  background: var(--front-wash);
}

.idx-temp {
  font-size: 1rem;
}

.idx-short {
  font-size: 0.8125rem;
  color: var(--ink-3);
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.idx-row.active .idx-short {
  color: var(--front);
}

.log {
  border-top: 1px solid var(--rule);
}

.log :deep(.song-log) {
  padding: 0 12px 10px;
}

.log :deep(.log-list) {
  border-top: 0;
}

.trace-strip {
  grid-column: 1 / -1;
  grid-row: 2;
  position: relative;
  border-top: 1px solid var(--rule);
  padding: 4px 20px 0 96px;
}

.strip-label {
  position: absolute;
  left: 20px;
  top: 14px;
  width: 4.5em;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--ink-3);
}

/* 窄屏 */
.view-station.compact {
  display: flex;
  flex-direction: column;
  height: auto;
}

.compact .stage {
  height: auto;
  display: flex;
  flex-direction: column;
  overflow: visible;
}

.compact .st-city {
  position: static;
  padding: 20px 18px 4px;
  order: 1;
}

.compact .st-sub,
.compact .st-state {
  position: static;
  padding: 0 18px 8px;
  order: 2;
}

.compact .glyph-svg {
  position: relative;
  order: 3;
  height: 360px;
  width: 100%;
}

.compact .st-note {
  position: static;
  order: 4;
  margin: 8px 16px 16px;
}

.compact .side {
  border-left: 0;
  border-top: 1px solid var(--rule);
}

.compact .trace-strip {
  height: 84px;
}
</style>
