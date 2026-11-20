<template>
  <section class="radio" aria-labelledby="radio-h">
    <h2 id="radio-h" class="r-title">电台</h2>
    <p class="r-mood">{{ customActive ? `正在按「${customTerm}」检索` : profile.moodTitle }}</p>

    <div class="r-row" role="group" aria-label="选歌方式">
      <button
        v-for="g in GENRE_MODES"
        :key="g.id"
        type="button"
        class="chart-btn"
        :aria-pressed="String(!customActive && genreMode === g.id)"
        @click="$emit('change-genre', g.id)"
      >
        {{ g.label }}
      </button>
    </div>

    <form class="r-row r-search" @submit.prevent="submit">
      <label class="sr-only" for="song-q">点歌</label>
      <input id="song-q" v-model="q" type="search" placeholder="点歌：歌名或歌手，如 稻香" autocomplete="off" />
      <button type="submit" class="chart-btn" :disabled="!q.trim()">检索</button>
      <button v-if="customActive" type="button" class="chart-btn" @click="reset">回到按天气推歌</button>
      <button type="button" class="chart-btn" :disabled="loading" @click="$emit('next-batch')">
        <ChartIcon name="refresh" :size="16" />换一批
      </button>
    </form>

    <details class="ambient">
      <summary>
        <span>环境声</span>
        <span class="amb-state">{{ ambientRunning ? '开 · 按当地天气混合雨、风、炉火、风铃' : '关' }}</span>
      </summary>
      <div class="amb-body">
        <button type="button" class="chart-btn" :aria-pressed="String(ambientRunning)" @click="$emit('toggle-ambient')">
          <ChartIcon name="volume" :size="16" />{{ ambientRunning ? '关闭环境声' : '打开环境声' }}
        </button>
        <label v-for="ch in CHANNELS" :key="ch.id" class="amb-ch">
          <span>{{ ch.label }}</span>
          <input
            class="scale-range"
            type="range"
            min="0"
            max="100"
            :value="ambientMix[ch.id]"
            :style="{ '--fill': `${ambientMix[ch.id]}%` }"
            @input="update(ch.id, $event.target.value)"
          />
          <span class="num amb-v">{{ ambientMix[ch.id] }}</span>
        </label>
        <button type="button" class="chart-btn" @click="$emit('reset-ambient-preset')">按天气重设</button>
      </div>
    </details>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import ChartIcon from './ChartIcon.vue'
import { GENRE_MODES } from '../utils/weatherMap'

const props = defineProps({
  profile: { type: Object, required: true },
  genreMode: { type: String, default: 'auto' },
  customActive: { type: Boolean, default: false },
  customTerm: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  ambientRunning: { type: Boolean, default: false },
  ambientMix: { type: Object, required: true }
})

const emit = defineEmits([
  'change-genre',
  'custom-search',
  'reset-custom',
  'next-batch',
  'toggle-ambient',
  'update-ambient-mix',
  'reset-ambient-preset'
])

const CHANNELS = [
  { id: 'rain', label: '雨' },
  { id: 'wind', label: '风' },
  { id: 'hearth', label: '炉火' },
  { id: 'chimes', label: '风铃' }
]

const q = ref('')

function submit() {
  const t = q.value.trim()
  if (t) emit('custom-search', t)
}

function reset() {
  q.value = ''
  emit('reset-custom')
}

function update(id, v) {
  emit('update-ambient-mix', { ...props.ambientMix, [id]: Number(v) })
}
</script>

<style scoped>
.radio {
  min-width: 0;
}

.r-title {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.r-mood {
  margin: 2px 0 12px;
  color: var(--ink-2);
  font-size: 0.9375rem;
}

.r-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.r-search input {
  flex: 1 1 220px;
  min-height: 34px;
  padding: 4px 10px;
  border: 1px solid var(--rule);
  border-radius: 2px;
  background: var(--paper-lift);
  outline: none;
  font-size: 0.9375rem;
}

.r-search input:focus {
  border-color: var(--chart);
  box-shadow: 0 0 0 1px var(--chart);
}

.ambient {
  margin-top: 6px;
  border-top: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
}

.ambient summary {
  display: flex;
  gap: 14px;
  align-items: baseline;
  padding: 9px 2px;
  cursor: pointer;
  list-style: none;
  font-weight: 700;
}

.ambient summary::-webkit-details-marker {
  display: none;
}

.ambient summary::before {
  content: '';
  width: 8px;
  height: 8px;
  border-right: 1.4px solid var(--ink);
  border-bottom: 1.4px solid var(--ink);
  transform: rotate(-45deg);
  transition: transform var(--dur-base) var(--ease-out);
  align-self: center;
}

.ambient[open] summary::before {
  transform: rotate(45deg);
}

.amb-state {
  font-weight: 400;
  font-size: 0.875rem;
  color: var(--ink-3);
}

.amb-body {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 22px;
  padding: 4px 2px 14px;
}

.amb-ch {
  display: grid;
  grid-template-columns: 2.4em 120px 2em;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
}

.amb-v {
  color: var(--ink-3);
  font-size: 0.8125rem;
}
</style>
