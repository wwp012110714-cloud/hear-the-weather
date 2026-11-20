<template>
  <div ref="box" class="view-map" :class="{ compact }">
    <!-- 图面：印刷网格 + 实况等温线 + 站点 -->
    <svg
      class="plot"
      :width="width"
      :height="svgH"
      :viewBox="`0 0 ${width} ${svgH}`"
      role="group"
      aria-label="各城市测站填图，点击站点切换城市"
    >
      <g class="graticule" aria-hidden="true">
        <line v-for="gx in gridX" :key="'gx' + gx" :x1="gx" :x2="gx" y1="0" :y2="isoBox.h" />
        <line v-for="gy in gridY" :key="'gy' + gy" x1="0" :x2="width" :y1="gy" :y2="gy" />
      </g>

      <g class="isotherms" aria-hidden="true">
        <path v-for="iso in isotherms" :key="'p' + iso.level" :d="iso.d" />
        <text
          v-for="iso in isotherms.filter((i) => i.label)"
          :key="'t' + iso.level"
          class="iso-label num"
          :x="iso.label.x"
          :y="iso.label.y + 4"
          text-anchor="middle"
        >{{ iso.level }}°</text>
      </g>

      <path v-if="leader" class="leader" :d="leader" aria-hidden="true" />

      <StationGlyph
        v-for="st in plotted"
        :key="st.city.id"
        :x="st.x"
        :y="st.y"
        :s="st.selected ? 1.25 : 1"
        :code="st.code"
        :temp="st.temp"
        :cloud-cover="st.cloudCover"
        :wind-speed="st.windSpeed"
        :wind-direction="st.windDirection"
        :name="st.city.name"
        :selected="st.selected"
        :temp-size="st.selected ? 15 : 13"
        :name-size="st.selected ? 15 : 13"
        interactive
        @select="$emit('select-city', st.city)"
      />

      <text v-if="offChart" class="off-note" :x="plotRect.x + plotRect.w / 2" :y="plotRect.y + 14" text-anchor="middle">
        {{ city.name }} 不在本图幅内，读数见左侧
      </text>
    </svg>

    <!-- 主站读数 -->
    <section class="hero" :style="heroStyle" aria-live="polite">
      <h2 class="h-city">{{ city.name }}</h2>
      <template v-if="r">
        <p class="h-temp num" :aria-label="`气温 ${r.tempInt} 度`">{{ r.tempInt }}<span class="deg">°</span></p>
        <dl class="key">
          <div><dt>天气</dt><dd>{{ r.label }}</dd></div>
          <div v-if="r.range"><dt>今日</dt><dd class="num">{{ r.range }}</dd></div>
          <div><dt>风</dt><dd>{{ r.windText }}</dd></div>
          <div><dt>湿度</dt><dd class="num">{{ r.humidity }}%</dd></div>
          <div><dt>气压</dt><dd class="num">{{ r.pressure }} hPa</dd></div>
          <div v-if="r.aqi != null">
            <dt>空气</dt>
            <dd class="num" :class="{ strong: r.aqiPoor }">AQI {{ r.aqi }} {{ r.aqiLabel }}</dd>
          </div>
          <div v-if="r.sunrise"><dt>日出落</dt><dd class="num">{{ r.sunrise }} / {{ r.sunset }}</dd></div>
          <div v-if="r.feels != null"><dt>体感</dt><dd class="num">{{ r.feels }}°</dd></div>
        </dl>
        <p class="obs num">观测 {{ r.obsTime }} · {{ r.provider }}</p>
      </template>
      <p v-else-if="error" class="h-state">
        {{ error }}
        <button type="button" class="chart-btn" @click="$emit('retry')">重新观测</button>
      </p>
      <p v-else class="h-state">观测中…</p>
    </section>

    <!-- 图注：播放器 + 歌曲记录 -->
    <aside class="annot" :style="annotStyle" aria-label="正在播放与歌曲记录">
      <PlayerNote
        :favorite-ids="favoriteIds"
        :basis="basis"
        :loading="musicLoading"
        :error="musicError"
        :fallback-notice="fallbackNotice"
        @toggle-favorite="$emit('toggle-favorite', $event)"
        @retry="$emit('retry-music')"
      />
      <SongLog class="annot-log" :tracks="tracks" :loading="musicLoading" :limit="5" />
    </aside>

    <!-- 底边：24 小时气温 -->
    <div class="trace-strip" :style="traceStyle">
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
import { makeProjection, buildIsotherms, inChinaBox, declutter } from '../utils/chart'
import { buildReadings } from '../utils/readings'

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

const box = ref(null)
const { width, height } = useSize(box, { width: 1300, height: 720 })

const r = computed(() => buildReadings(props.weather))

const TRACE_H = 78
const ANNOT_W = 304
const ANNOT_R = 28

const heroW = computed(() => Math.round(Math.min(330, Math.max(270, width.value * 0.24))))
const svgH = computed(() => (props.compact ? 380 : Math.max(420, height.value - TRACE_H)))

const isoBox = computed(() => ({ x: 0, y: 0, w: width.value, h: svgH.value }))

const plotRect = computed(() => {
  if (props.compact) return { x: 30, y: 30, w: width.value - 60, h: svgH.value - 70 }
  const x = heroW.value + 64
  const right = ANNOT_W + ANNOT_R + 56
  return { x, y: 44, w: Math.max(260, width.value - x - right), h: svgH.value - 44 - 56 }
})

const annotTop = computed(() => Math.round(Math.max(64, Math.min(svgH.value * 0.3, svgH.value - 420))))

const gridX = computed(() => {
  const n = Math.max(6, Math.round(width.value / 110))
  return Array.from({ length: n - 1 }, (_, i) => Math.round(((i + 1) * width.value) / n) + 0.5)
})
const gridY = computed(() => {
  const n = Math.max(4, Math.round(svgH.value / 110))
  return Array.from({ length: n - 1 }, (_, i) => Math.round(((i + 1) * svgH.value) / n) + 0.5)
})

const projection = computed(() => makeProjection(props.stations.map((s) => s.city), plotRect.value))

const plotted = computed(() => {
  const { project } = projection.value
  const list = props.stations
    .filter((s) => inChinaBox(s.city))
    .map((s) => {
      const selected = s.city.id === props.city.id
      const cur = selected && props.weather?.current
      const snap = s.snap || {}
      const p = project(s.city)
      return {
        city: s.city,
        selected,
        x: p.x,
        y: p.y,
        code: cur ? cur.code : snap.code ?? null,
        temp: cur ? cur.temp : snap.temp ?? null,
        cloudCover: cur ? cur.cloudCover : snap.cloudCover ?? null,
        windSpeed: cur ? cur.windSpeed : snap.windSpeed ?? null,
        windDirection: cur ? cur.windDirection : snap.windDirection ?? null
      }
    })
  declutter(list, plotRect.value, props.compact ? 44 : 58)
  return list.sort((a, b) => Number(a.selected) - Number(b.selected))
})

const offChart = computed(() => !inChinaBox(props.city))

const isotherms = computed(() =>
  buildIsotherms(
    plotted.value.map((p) => ({ x: p.x, y: p.y, value: p.temp })),
    isoBox.value,
    4
  ).map((iso) => ({
    ...iso,
    // 标注离站点太近会压住站点读数，此时只画线不写数
    label: plotted.value.some((p) => Math.hypot(p.x - iso.label.x, p.y - iso.label.y) < 34) ? null : iso.label
  }))
)

const leader = computed(() => {
  if (props.compact) return ''
  const sel = plotted.value.find((p) => p.selected)
  if (!sel) return ''
  const tx = width.value - ANNOT_R - ANNOT_W
  const ty = annotTop.value + 26
  if (Math.abs(sel.y - ty) < 4) return `M${sel.x + 16} ${sel.y}H${tx}`
  const others = plotted.value.filter((p) => !p.selected)
  // 两种直角走线：先横后竖 / 先竖后横，选离其它站点更远的一条
  const routes = [
    { d: `M${sel.x + 16} ${sel.y}H${tx - 28}V${ty}H${tx}`, segs: [[sel.x + 16, sel.y, tx - 28, sel.y], [tx - 28, sel.y, tx - 28, ty], [tx - 28, ty, tx, ty]] },
    {
      d: `M${sel.x} ${sel.y + (ty < sel.y ? -16 : 16)}V${ty}H${tx}`,
      segs: [[sel.x, sel.y, sel.x, ty], [sel.x, ty, tx, ty]]
    }
  ]
  const near = (seg, p) => {
    const [x1, y1, x2, y2] = seg
    const cxp = Math.max(Math.min(x1, x2), Math.min(Math.max(x1, x2), p.x))
    const cyp = Math.max(Math.min(y1, y2), Math.min(Math.max(y1, y2), p.y))
    return Math.hypot(p.x - cxp, p.y - cyp)
  }
  const cost = (r) =>
    others.reduce((acc, p) => acc + r.segs.reduce((m, sg) => m + Math.max(0, 40 - near(sg, p)), 0), 0)
  return routes.reduce((a, b) => (cost(b) < cost(a) ? b : a)).d
})

const heroStyle = computed(() => (props.compact ? {} : { width: `${heroW.value}px` }))
const annotStyle = computed(() =>
  props.compact ? {} : { width: `${ANNOT_W}px`, right: `${ANNOT_R}px`, top: `${annotTop.value}px` }
)
const traceStyle = computed(() => (props.compact ? {} : { height: `${TRACE_H}px` }))
</script>

<style scoped>
.view-map {
  position: relative;
  width: 100%;
  height: 100%;
}

.plot {
  position: absolute;
  inset: 0 0 auto 0;
  display: block;
}

.graticule line {
  stroke: var(--grid);
  stroke-width: 1;
}

.isotherms path {
  fill: none;
  stroke: var(--chart);
  stroke-width: 1.2;
  opacity: 0.85;
}

.iso-label {
  font-size: 12px;
  fill: var(--chart);
  font-family: var(--serif);
  paint-order: stroke;
  stroke: var(--paper);
  stroke-width: 5px;
  stroke-linejoin: round;
}

.leader {
  fill: none;
  stroke: var(--front);
  stroke-width: 1.2;
}

.off-note {
  font-size: 13px;
  fill: var(--ink-3);
  font-family: var(--serif);
}

/* 主站读数 */
.hero {
  position: absolute;
  left: 36px;
  top: 34px;
  z-index: 2;
}

.h-city {
  margin: 0;
  font-size: clamp(3.25rem, 5.6vw, 5.5rem);
  line-height: 1;
  font-weight: 400;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.h-temp {
  margin: 0.02em 0 0.12em -0.04em;
  font-size: clamp(5.5rem, 10vw, 9.25rem);
  line-height: 0.92;
  letter-spacing: -0.04em;
}

.deg {
  font-size: 0.6em;
  vertical-align: 0.62em;
  margin-left: 0.04em;
  letter-spacing: 0;
}

.key {
  margin: 0;
  display: grid;
  gap: 1px;
  font-size: 0.9375rem;
  line-height: 1.55;
}

.key div {
  display: grid;
  grid-template-columns: 3.4em 1fr;
  gap: 10px;
}

.key dt {
  color: var(--ink-3);
}

.key dd {
  margin: 0;
  color: var(--ink);
}

.key dd.strong {
  font-weight: 700;
  text-decoration: underline;
  text-decoration-color: var(--ink);
  text-underline-offset: 4px;
}

.obs {
  margin: 10px 0 0;
  font-size: 0.8125rem;
  color: var(--ink-3);
}

.h-state {
  margin: 18px 0 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  color: var(--ink-2);
}

/* 图注框 */
.annot {
  position: absolute;
  z-index: 2;
  padding: 14px 16px 12px;
  background: var(--paper-lift);
  border: 1px solid var(--rule);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.annot-log {
  margin-top: 2px;
}

/* 底边气温曲线 */
.trace-strip {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
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

/* 窄屏：纵向排布 */
.view-map.compact {
  display: flex;
  flex-direction: column;
  height: auto;
}

.compact .hero {
  position: static;
  order: 1;
  padding: 20px 18px 8px;
}

.compact .plot {
  position: relative;
  order: 2;
  border-top: 1px solid var(--rule-soft);
  border-bottom: 1px solid var(--rule-soft);
}

.compact .annot {
  position: static;
  order: 3;
  margin: 16px;
}

.compact .trace-strip {
  position: relative;
  order: 4;
  height: 84px;
}
</style>
