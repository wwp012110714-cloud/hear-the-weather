<template>
  <g
    class="station"
    :class="{ selected, interactive }"
    :transform="`translate(${x} ${y})`"
    :role="interactive ? 'button' : undefined"
    :tabindex="interactive ? 0 : undefined"
    :aria-label="interactive ? ariaLabel : undefined"
    :aria-pressed="interactive ? String(selected) : undefined"
    @click="interactive && $emit('select')"
    @keydown.enter.prevent="interactive && $emit('select')"
    @keydown.space.prevent="interactive && $emit('select')"
  >
    <!-- 命中区域 -->
    <rect v-if="interactive" class="hit" :x="-44 * s" :y="-30 * s" :width="96 * s" :height="64 * s" />

    <g :transform="`scale(${s})`">
      <!-- 风羽 -->
      <g v-if="barb && !barb.calm" class="barb">
        <line :x1="barb.shaft[0]" :y1="barb.shaft[1]" :x2="barb.shaft[2]" :y2="barb.shaft[3]" />
        <line v-for="(b, i) in barb.barbs" :key="'b' + i" :x1="b[0]" :y1="b[1]" :x2="b[2]" :y2="b[3]" />
        <polygon v-for="(f, i) in barb.flags" :key="'f' + i" :points="f" class="flag" />
      </g>
      <circle v-if="barb && barb.calm" :r="R + 3.2" class="calm" />

      <!-- 站圈与云量；选中站点外加一道暖锋红圈 -->
      <circle v-if="selected" :r="R + 4.5" class="mark" />
      <circle :r="R" class="ring" />
      <path v-if="coverPath" :d="coverPath" class="cover" />
      <g v-if="oktas === 9" class="cover-x">
        <line :x1="-R * 0.7" :y1="-R * 0.7" :x2="R * 0.7" :y2="R * 0.7" />
        <line :x1="R * 0.7" :y1="-R * 0.7" :x2="-R * 0.7" :y2="R * 0.7" />
      </g>

      <!-- 天气现象（站圈左侧） -->
      <g v-if="ww" class="ww" :transform="`translate(${-R - 9} 0)`">
        <template v-if="ww === 'rain'">
          <circle cx="-2.6" cy="0" r="1.7" />
          <circle cx="2.6" cy="0" r="1.7" />
        </template>
        <template v-else-if="ww === 'drizzle'">
          <path d="M-3 -1.2a1.6 1.6 0 1 1 1.2 1.6l-1.4 2.4M3 -1.2a1.6 1.6 0 1 1 1.2 1.6l-1.4 2.4" class="stroke" />
        </template>
        <template v-else-if="ww === 'snow'">
          <path d="M0 -4v8M-3.5 -2l7 4M-3.5 2l7 -4" class="stroke" />
        </template>
        <template v-else-if="ww === 'shower'">
          <path d="M-3.4 -0.6h6.8L0 5z" class="stroke" />
          <circle cx="0" cy="-3.6" r="1.6" />
        </template>
        <template v-else-if="ww === 'fog'">
          <path d="M-5 -3h10M-5 0h10M-5 3h10" class="stroke" />
        </template>
        <template v-else-if="ww === 'storm'">
          <path d="M-4.5 4.5v-9h8l-3 4.5h3l-4.5 5.5" class="stroke" />
        </template>
      </g>
    </g>

    <!-- 气温（左上）与站名（下方） -->
    <text
      v-if="tempText"
      class="t-temp num"
      :x="-(R + 4) * s"
      :y="-(R + 3) * s"
      text-anchor="end"
      :font-size="tempSize"
    >{{ tempText }}</text>
    <text v-if="name" class="t-name" :x="0" :y="(R + 6) * s + nameSize" text-anchor="middle" :font-size="nameSize">
      {{ name }}<tspan v-if="sub" class="t-sub" :font-size="nameSize * 0.82" dx="4">{{ sub }}</tspan>
    </text>
  </g>
</template>

<script setup>
import { computed } from 'vue'
import { cloudOktas, presentWeather, windBarb } from '../utils/chart'

const props = defineProps({
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  s: { type: Number, default: 1 },
  code: { type: Number, default: null },
  temp: { type: Number, default: null },
  cloudCover: { type: Number, default: null },
  windSpeed: { type: Number, default: null },
  windDirection: { type: Number, default: null },
  name: { type: String, default: '' },
  sub: { type: String, default: '' },
  selected: { type: Boolean, default: false },
  interactive: { type: Boolean, default: false },
  tempSize: { type: Number, default: 13 },
  nameSize: { type: Number, default: 13 }
})

defineEmits(['select'])

const R = 7

const oktas = computed(() => (props.code == null ? null : cloudOktas(props.code, props.cloudCover)))
const ww = computed(() => (props.code == null ? null : presentWeather(props.code)))
const barb = computed(() => windBarb(props.windSpeed, props.windDirection, R, 24, 9))
const tempText = computed(() => (Number.isFinite(props.temp) ? `${Math.round(props.temp)}°` : ''))

const coverPath = computed(() => {
  const o = oktas.value
  if (o == null || o === 0 || o === 9) return ''
  const f = Math.min(1, Math.round(o / 2) / 4)
  if (f >= 1) return `M0 ${-R}A${R} ${R} 0 1 1 0 ${R}A${R} ${R} 0 1 1 0 ${-R}Z`
  const a = f * Math.PI * 2
  const ex = Math.sin(a) * R
  const ey = -Math.cos(a) * R
  return `M0 0L0 ${-R}A${R} ${R} 0 ${f > 0.5 ? 1 : 0} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}Z`
})

const ariaLabel = computed(() => {
  const parts = [props.name]
  if (tempText.value) parts.push(`${Math.round(props.temp)} 度`)
  parts.push(props.selected ? '当前站点' : '切换到此站点')
  return parts.join('，')
})
</script>

<style scoped>
.station {
  color: var(--ink);
}

.station.interactive {
  cursor: pointer;
  outline: none;
}

.hit {
  fill: transparent;
}

.ring {
  fill: var(--paper);
  stroke: currentColor;
  stroke-width: 1.3;
}

.cover,
.ww circle {
  fill: currentColor;
}

.cover-x line,
.barb line,
.ww .stroke,
.calm {
  stroke: currentColor;
  stroke-width: 1.3;
  fill: none;
}

.flag {
  fill: currentColor;
}

.t-temp {
  fill: currentColor;
  font-family: var(--serif);
}

.t-name {
  fill: currentColor;
  font-family: var(--serif);
  letter-spacing: 0.04em;
}

.t-sub {
  fill: var(--ink-3);
}

.station.selected {
  color: var(--front);
}

.mark {
  fill: none;
  stroke: var(--front);
  stroke-width: 1.3;
}

.station.interactive:hover:not(.selected) .t-name {
  fill: var(--chart);
}

.station.interactive:focus-visible .hit {
  stroke: var(--chart);
  stroke-width: 1.5;
  stroke-dasharray: 3 3;
}
</style>
