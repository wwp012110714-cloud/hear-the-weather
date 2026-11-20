<template>
  <div class="ambient-mixer">
    <div class="mixer-header">
      <div class="mixer-title-wrap">
        <span class="sound-wave-dot" :class="{ active: running }"></span>
        <div>
          <div class="mixer-title">实时气象环境白噪音混音</div>
          <div class="mixer-sub">根据当地风速、降雨与温度自动调配，可与黑胶音乐叠加聆听</div>
        </div>
      </div>

      <div class="mixer-actions">
        <button
          v-if="expanded"
          type="button"
          class="sync-btn"
          title="重新按当前城市实时天气恢复默认混音比例"
          @click="$emit('reset-preset')"
        >
          同步天气预设
        </button>
        <button
          type="button"
          class="expand-btn"
          @click="expanded = !expanded"
        >
          {{ expanded ? '收起调音' : '精细调音' }}
        </button>
        <button
          type="button"
          class="power-btn"
          :class="{ on: running }"
          @click="$emit('toggle-running')"
        >
          {{ running ? '环境声 · 播放中' : '开启环境声' }}
        </button>
      </div>
    </div>

    <div v-if="expanded" class="sliders-grid">
      <div v-for="ch in channels" :key="ch.key" class="channel-item">
        <div class="ch-top">
          <span class="ch-name">{{ ch.label }}</span>
          <span class="ch-val tabular-nums">{{ mix[ch.key] }}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          :value="mix[ch.key]"
          class="ch-slider"
          @input="onSlider(ch.key, $event.target.value)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  running: {
    type: Boolean,
    default: false
  },
  mix: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['toggle-running', 'update-mix', 'reset-preset'])

const expanded = ref(false)

const channels = [
  { key: 'rain', label: '细雨敲窗' },
  { key: 'wind', label: '微风拂叶' },
  { key: 'hearth', label: '冬夜围炉' },
  { key: 'chimes', label: '晴空风铃' }
]

function onSlider(key, val) {
  emit('update-mix', { ...props.mix, [key]: Number(val) })
}
</script>

<style scoped>
.ambient-mixer {
  padding: 13px 16px;
  border-radius: 16px;
  background: rgba(8, 15, 28, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.09);
}

.mixer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.mixer-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sound-wave-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.28);
  flex-shrink: 0;
  transition: all 0.25s;
}

.sound-wave-dot.active {
  background: #34d399;
  box-shadow: 0 0 0 5px rgba(52, 211, 153, 0.2);
}

.mixer-title {
  font-size: 0.86rem;
  font-weight: 600;
}

.mixer-sub {
  font-size: 0.73rem;
  color: var(--text-muted);
  margin-top: 2px;
}

.mixer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sync-btn,
.expand-btn {
  height: 32px;
  padding: 0 11px;
  border-radius: 999px;
  border: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.05);
  font-size: 0.76rem;
  color: var(--text-secondary);
}

.sync-btn:hover,
.expand-btn:hover {
  background: rgba(255, 255, 255, 0.11);
}

.power-btn {
  height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--accent-border);
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 0.78rem;
  font-weight: 600;
  transition: all 0.2s;
}

.power-btn.on {
  background: var(--accent);
  color: #0f172a;
}

.sliders-grid {
  margin-top: 13px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.channel-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ch-top {
  display: flex;
  justify-content: space-between;
  font-size: 0.74rem;
  color: var(--text-secondary);
}

.ch-val {
  color: var(--accent-text);
}

.ch-slider {
  width: 100%;
  accent-color: var(--accent);
  cursor: pointer;
}

@media (max-width: 720px) {
  .sliders-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
