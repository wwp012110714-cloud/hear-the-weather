<template>
  <div ref="box" class="temp-trace">
    <svg :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" role="img" :aria-label="aria">
      <line class="base" :x1="0" :x2="width" :y1="axisY" :y2="axisY" />
      <path v-if="d" class="trace" :d="d" />
      <g v-for="t in ticks" :key="t.i">
        <line class="tick" :x1="t.x" :x2="t.x" :y1="axisY" :y2="axisY + (t.major ? 6 : 3)" />
        <text v-if="t.major" class="hour num" :x="t.x" :y="height - 4" text-anchor="middle">{{ t.label }}</text>
      </g>
      <g v-if="extremes">
        <circle class="pt" :cx="extremes.max.x" :cy="extremes.max.y" r="2.4" />
        <text class="ext num" :x="extremes.max.x" :y="extremes.max.y - 6" text-anchor="middle">
          {{ Math.round(extremes.max.v) }}°
        </text>
        <circle class="pt" :cx="extremes.min.x" :cy="extremes.min.y" r="2.4" />
        <text class="ext num" :x="extremes.min.x + 7" :y="extremes.min.y - 6" text-anchor="start">
          {{ Math.round(extremes.min.v) }}°
        </text>
      </g>
    </svg>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useSize } from '../composables/useSize'
import { smoothPath } from '../utils/chart'

const props = defineProps({
  hourly: { type: Array, default: () => [] }
})

const box = ref(null)
const { width, height } = useSize(box, { width: 1200, height: 68 })

const pad = 14
const axisY = computed(() => height.value - 20)

const pts = computed(() => {
  const list = props.hourly
  if (list.length < 2) return []
  const temps = list.map((h) => h.temp)
  const lo = Math.min(...temps)
  const hi = Math.max(...temps)
  const span = Math.max(4, hi - lo)
  const top = 14
  const bottom = axisY.value - 8
  return list.map((h, i) => ({
    x: pad + (i / (list.length - 1)) * (width.value - pad * 2),
    y: bottom - ((h.temp - lo) / span) * (bottom - top),
    v: h.temp,
    label: h.hourLabel
  }))
})

const d = computed(() => smoothPath(pts.value.map((p) => [p.x, p.y])))

const ticks = computed(() =>
  pts.value.map((p, i) => ({ i, x: p.x, major: i % 3 === 0, label: p.label }))
)

const extremes = computed(() => {
  if (!pts.value.length) return null
  let max = pts.value[0]
  let min = pts.value[0]
  for (const p of pts.value) {
    if (p.v > max.v) max = p
    if (p.v < min.v) min = p
  }
  return { max, min }
})

const aria = computed(() =>
  extremes.value
    ? `未来 24 小时气温曲线，最高 ${Math.round(extremes.value.max.v)} 度，最低 ${Math.round(extremes.value.min.v)} 度`
    : '未来 24 小时气温曲线'
)
</script>

<style scoped>
.temp-trace {
  width: 100%;
  height: 100%;
  min-height: 60px;
}

svg {
  display: block;
  overflow: visible;
}

.base {
  stroke: var(--rule);
  stroke-width: 1;
}

.tick {
  stroke: var(--rule);
  stroke-width: 1;
}

.trace {
  fill: none;
  stroke: var(--ink);
  stroke-width: 1.6;
}

.pt {
  fill: var(--ink);
}

.hour {
  font-size: 11px;
  fill: var(--ink-2);
  font-family: var(--serif);
}

.ext {
  font-size: 12px;
  fill: var(--ink);
  font-family: var(--serif);
}
</style>
