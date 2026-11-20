<template>
  <div class="view-trace" :class="{ compact }">
    <!-- 测站切换条 -->
    <nav class="tabs" aria-label="切换测站">
      <button
        v-for="st in tabs"
        :key="st.city.id"
        type="button"
        class="tab"
        :class="{ active: st.selected }"
        :aria-pressed="String(st.selected)"
        @click="$emit('select-city', st.city)"
      >
        <span>{{ st.city.name }}</span>
        <span class="num">{{ st.temp != null ? Math.round(st.temp) + '°' : '—' }}</span>
      </button>
    </nav>

    <!-- 站名与读数 -->
    <header class="head">
      <h2 class="t-city">{{ city.name }}</h2>
      <p v-if="r" class="t-temp num">{{ r.tempInt }}<span class="deg">°</span></p>
      <dl v-if="r" class="t-key">
        <div><dt>天气</dt><dd>{{ r.label }}</dd></div>
        <div v-if="r.range"><dt>今日</dt><dd class="num">{{ r.range }}</dd></div>
        <div><dt>风</dt><dd>{{ r.windText }}</dd></div>
        <div><dt>湿度</dt><dd class="num">{{ r.humidity }}%</dd></div>
        <div v-if="r.aqi != null">
          <dt>空气</dt><dd class="num" :class="{ strong: r.aqiPoor }">AQI {{ r.aqi }} {{ r.aqiLabel }}</dd>
        </div>
        <div><dt>气压</dt><dd class="num">{{ r.pressure }} hPa</dd></div>
      </dl>
      <p v-else-if="error" class="t-state">
        {{ error }} <button type="button" class="chart-btn" @click="$emit('retry')">重新观测</button>
      </p>
      <p v-else class="t-state">观测中…</p>
      <p class="t-caption">温度自记纸 · 未来 24 小时 · 歌曲按时次写在曲线上</p>
    </header>

    <!-- 自记纸 -->
    <div ref="paper" class="paper">
      <svg :width="pw" :height="ph" :viewBox="`0 0 ${pw} ${ph}`" role="img" :aria-label="aria">
        <g class="t-lines" aria-hidden="true">
          <g v-for="t in tempLines" :key="'t' + t.v">
            <line :class="{ major: t.major }" :x1="L" :x2="pw - Rm" :y1="t.y" :y2="t.y" />
            <text v-if="t.major" class="t-label num" :x="L - 8" :y="t.y + 4" text-anchor="end">{{ t.v }}°</text>
          </g>
        </g>
        <g class="h-arcs" aria-hidden="true">
          <path v-for="a in hourArcs" :key="'a' + a.i" :class="{ major: a.major }" :d="a.d" />
          <text
            v-for="a in hourArcs.filter((x) => x.major)"
            :key="'h' + a.i"
            class="h-label num"
            :x="a.bx"
            :y="ph - 8"
            text-anchor="middle"
          >{{ a.label }}</text>
        </g>
        <path v-if="traceD" class="pen" :d="traceD" />
        <circle
          v-for="m in marks"
          :key="'m' + m.i"
          class="pen-pt"
          :class="{ now: m.i === 0 }"
          :cx="m.x"
          :cy="m.y"
          :r="m.i === 0 ? 5 : 3.5"
        />
        <text v-for="m in marks" :key="'v' + m.i" class="pt-temp num" :x="m.x" :y="m.y + (m.up ? 22 : -12)" text-anchor="middle">
          {{ Math.round(m.v) }}°
        </text>
      </svg>

      <!-- 「现在」批注：播放器 -->
      <aside v-if="nowMark && !compact" class="now-note" :style="nowStyle" aria-label="正在播放">
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

      <!-- 之后各时次的歌 -->
      <button
        v-for="m in songMarks"
        :key="'s' + m.i"
        type="button"
        class="song-mark"
        :class="{ active: currentTrack?.id === m.track.id, up: m.up, flip: m.flip }"
        :style="{ left: `${m.x}px`, top: `${m.y}px` }"
        :aria-label="`${m.label} 时次：${m.track.artist}《${m.track.title}》，点击播放`"
        @click="play(m.track)"
      >
        <span class="sm-hour num">{{ m.label }}</span>
        <span class="sm-title">{{ m.track.artist }}《{{ m.track.title }}》</span>
      </button>
    </div>

    <aside v-if="compact" class="now-note" aria-label="正在播放">
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
</template>

<script setup>
import { ref, computed } from 'vue'
import PlayerNote from './PlayerNote.vue'
import { useSize } from '../composables/useSize'
import { usePlayer } from '../composables/usePlayer'
import { buildReadings } from '../utils/readings'
import { smoothPath } from '../utils/chart'

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

const { currentTrack, play } = usePlayer()

const paper = ref(null)
const { width: pw, height: phRaw } = useSize(paper, { width: 1300, height: 460 })
const ph = computed(() => (props.compact ? 380 : Math.max(300, phRaw.value)))

const r = computed(() => buildReadings(props.weather))
const hourly = computed(() => props.weather?.hourly24 || [])

const L = 52
const Rm = 24
const T = 18
const B = 30

const range = computed(() => {
  const temps = hourly.value.map((h) => h.temp)
  if (!temps.length) return { lo: 0, hi: 20 }
  let lo = Math.floor(Math.min(...temps) - 3)
  let hi = Math.ceil(Math.max(...temps) + 3)
  if (hi - lo < 10) {
    const mid = (hi + lo) / 2
    lo = Math.floor(mid - 5)
    hi = Math.ceil(mid + 5)
  }
  return { lo, hi }
})

const ch = computed(() => ph.value - T - B)
const cw = computed(() => pw.value - L - Rm)
const yMid = computed(() => T + ch.value / 2)
const Ra = computed(() => ch.value * 1.6)

const yOf = (t) => T + ((range.value.hi - t) / (range.value.hi - range.value.lo)) * ch.value
const arcOff = (y) => Ra.value - Math.sqrt(Math.max(0, Ra.value ** 2 - (y - yMid.value) ** 2))
const n = computed(() => Math.max(2, hourly.value.length || 24))
const xBase = (i) => L + (i / (n.value - 1)) * cw.value - arcOff(T) / 2

const tempLines = computed(() => {
  const out = []
  for (let v = range.value.lo; v <= range.value.hi; v++) {
    out.push({ v, y: Math.round(yOf(v)) + 0.5, major: v % 5 === 0 })
  }
  return out
})

const hourArcs = computed(() => {
  const list = []
  const top = T
  const bot = T + ch.value
  for (let i = 0; i < n.value; i++) {
    const xb = xBase(i)
    const x1 = xb + arcOff(top)
    const x2 = xb + arcOff(bot)
    list.push({
      i,
      major: i % 3 === 0,
      d: `M${x1.toFixed(1)} ${top}A${Ra.value.toFixed(1)} ${Ra.value.toFixed(1)} 0 0 0 ${x2.toFixed(1)} ${bot}`,
      bx: x2,
      label: hourly.value[i]?.hourLabel || ''
    })
  }
  return list
})

const pts = computed(() =>
  hourly.value.map((h, i) => {
    const y = yOf(h.temp)
    return { i, x: xBase(i) + arcOff(y), y, v: h.temp, label: h.hourLabel }
  })
)

const traceD = computed(() => smoothPath(pts.value.map((p) => [p.x, p.y])))

const songSlots = computed(() => {
  const len = pts.value.length
  if (len < 8) return []
  const want = props.compact ? 2 : 6
  // 歌曲批注从「现在」播放器框的右边之后开始，避免互相遮挡
  const clear = props.compact ? 0 : pts.value[0].x + 18 + 280 + 24
  let first = pts.value.findIndex((p) => p.x > clear)
  if (first < 0) first = len - 2
  const start = Math.min(len - 2, Math.max(props.compact ? 9 : 4, first))
  const span = len - 2 - start
  return Array.from({ length: want }, (_, k) => start + Math.round((k * span) / Math.max(1, want - 1)))
})

const marks = computed(() => {
  const idx = new Set([0, ...songSlots.value])
  const list = pts.value
  return list
    .filter((p) => idx.has(p.i))
    .map((p) => {
      const a = list[Math.max(0, p.i - 1)]
      const b = list[Math.min(list.length - 1, p.i + 1)]
      // 曲线向右下走时，右上方是空白，批注写在上面；反之写在下面
      const up = b.y - a.y > 0 || (b.y === a.y && p.y > yMid.value)
      return { ...p, up, flip: p.x > pw.value - 220 }
    })
})

const nowMark = computed(() => marks.value.find((m) => m.i === 0))

const songMarks = computed(() =>
  marks.value
    .filter((m) => m.i !== 0)
    .map((m, k) => ({ ...m, track: props.tracks[k + 1] }))
    .filter((m) => m.track)
)

const nowStyle = computed(() => {
  const m = nowMark.value
  if (!m || props.compact) return {}
  const w = 280
  const below = m.y < yMid.value
  return {
    left: `${Math.round(m.x + 18)}px`,
    width: `${w}px`,
    ...(below ? { top: `${Math.round(m.y + 26)}px` } : { bottom: `${Math.round(ph.value - m.y + 26)}px` })
  }
})

const tabs = computed(() =>
  props.stations.map((s) => {
    const selected = s.city.id === props.city.id
    return {
      city: s.city,
      selected,
      temp: selected && props.weather?.current ? props.weather.current.temp : s.snap?.temp ?? null
    }
  })
)

const aria = computed(() => {
  if (!pts.value.length) return '温度自记曲线'
  const temps = pts.value.map((p) => p.v)
  return `${props.city.name} 未来 24 小时温度自记曲线，最高 ${Math.round(Math.max(...temps))} 度，最低 ${Math.round(
    Math.min(...temps)
  )} 度`
})
</script>

<style scoped>
.view-trace {
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
}

.tabs {
  display: flex;
  overflow-x: auto;
  border-bottom: 1px solid var(--rule);
  scrollbar-width: thin;
}

.tab {
  flex: 0 0 auto;
  display: inline-flex;
  gap: 8px;
  align-items: baseline;
  padding: 9px 18px;
  border-right: 1px solid var(--rule-soft);
  font-size: 0.9375rem;
  transition:
    background-color var(--dur-fast) ease,
    color var(--dur-fast) ease;
}

.tab:hover {
  background: rgba(44, 90, 138, 0.06);
}

.tab.active {
  color: var(--front);
  background: var(--front-wash);
}

.head {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: end;
  gap: 4px 28px;
  padding: 18px 36px 12px;
  border-bottom: 1px solid var(--rule-soft);
}

.t-city {
  margin: 0;
  font-size: clamp(2.75rem, 4.4vw, 4.25rem);
  line-height: 1;
  font-weight: 400;
  letter-spacing: 0.04em;
}

.t-temp {
  margin: 0;
  font-size: clamp(3.5rem, 6vw, 5.5rem);
  line-height: 0.9;
  letter-spacing: -0.04em;
}

.deg {
  font-size: 0.6em;
  vertical-align: 0.6em;
  letter-spacing: 0;
}

.t-key {
  margin: 0;
  justify-self: start;
  display: grid;
  grid-template-columns: repeat(3, auto);
  gap: 2px 28px;
  padding: 8px 14px;
  border: 1px solid var(--rule);
  font-size: 0.875rem;
}

.t-key div {
  display: flex;
  gap: 8px;
}

.t-key dt {
  color: var(--ink-3);
}

.t-key dd {
  margin: 0;
}

.t-key dd.strong {
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 4px;
}

.t-state {
  margin: 0;
  color: var(--ink-2);
}

.t-caption {
  grid-column: 1 / -1;
  margin: 6px 0 0;
  font-size: 0.8125rem;
  color: var(--ink-3);
}

.paper {
  position: relative;
  min-height: 0;
  overflow: hidden;
}

svg {
  position: absolute;
  inset: 0;
  display: block;
}

.t-lines line {
  stroke: var(--grid);
  stroke-width: 1;
}

.t-lines line.major {
  stroke: var(--grid-strong);
}

.t-label,
.h-label {
  font-size: 12px;
  fill: var(--chart);
  font-family: var(--serif);
}

.h-arcs path {
  fill: none;
  stroke: var(--grid);
  stroke-width: 1;
}

.h-arcs path.major {
  stroke: var(--grid-strong);
  stroke-width: 1.2;
}

.pen {
  fill: none;
  stroke: var(--front);
  stroke-width: 2.4;
  stroke-linecap: round;
}

.pen-pt {
  fill: var(--front);
}

.pen-pt.now {
  fill: var(--paper);
  stroke: var(--front);
  stroke-width: 2.4;
}

.pt-temp {
  font-size: 13px;
  fill: var(--ink);
  font-family: var(--serif);
  paint-order: stroke;
  stroke: var(--paper);
  stroke-width: 4px;
}

.now-note {
  position: absolute;
  padding: 12px 14px 10px;
  background: var(--paper-lift);
  border: 1px solid var(--front);
  z-index: 2;
}

.song-mark {
  position: absolute;
  transform: translate(10px, 14px);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  max-width: 190px;
  padding: 2px 6px;
  text-align: left;
  line-height: 1.35;
  color: var(--front);
  background: rgba(246, 247, 243, 0.88);
  transition: background-color var(--dur-fast) ease;
}

.song-mark.up {
  transform: translate(10px, calc(-100% - 14px));
}

.song-mark.flip {
  transform: translate(calc(-100% - 10px), 14px);
  align-items: flex-end;
  text-align: right;
}

.song-mark.flip.up {
  transform: translate(calc(-100% - 10px), calc(-100% - 14px));
}

.song-mark:hover {
  background: var(--front-wash);
}

.sm-hour {
  font-size: 0.75rem;
  color: var(--ink-3);
}

.sm-title {
  font-size: 0.9375rem;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-mark.active .sm-title {
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 4px;
}

/* 窄屏 */
.view-trace.compact {
  display: flex;
  flex-direction: column;
  height: auto;
}

.compact .head {
  grid-template-columns: auto auto;
  padding: 16px 18px 10px;
}

.compact .t-key {
  grid-column: 1 / -1;
  grid-template-columns: repeat(2, auto);
}

.compact .paper {
  height: 380px;
  flex: none;
}

.compact .now-note {
  position: relative;
  margin: 0 16px 16px;
}
</style>
