<template>
  <section class="city-roam-bar glass-panel" aria-label="国内城市实时气象漫游栏">
    <div class="roam-label">
      <span class="pulse-dot"></span>
      <span>实时漫游</span>
    </div>

    <div class="city-pills-scroll">
      <button
        v-for="city in cities"
        :key="city.id"
        type="button"
        class="city-pill"
        :class="{ selected: currentCity?.id === city.id }"
        @click="$emit('select-city', city)"
      >
        <div class="pill-top">
          <span class="city-name">{{ city.name }}</span>
          <WeatherIcon
            v-if="snapshots[city.id]"
            :type="getIcon(snapshots[city.id])"
            :size="18"
          />
        </div>
        <div class="pill-bottom">
          <span class="city-vibe">{{ city.vibe || city.region || '探索目的地' }}</span>
          <span v-if="snapshots[city.id]" class="city-temp tabular-nums">
            {{ snapshots[city.id].temp }}°
          </span>
          <span v-else class="city-temp-loading">···</span>
        </div>
      </button>
    </div>
  </section>
</template>

<script setup>
import WeatherIcon from './WeatherIcon.vue'
import { getWeatherMeta } from '../utils/weatherMap'

defineProps({
  cities: {
    type: Array,
    default: () => []
  },
  currentCity: {
    type: Object,
    default: null
  },
  snapshots: {
    type: Object,
    default: () => ({})
  }
})

defineEmits(['select-city'])

function getIcon(snap) {
  return getWeatherMeta(snap.code, snap.isDay, snap.temp).icon
}
</script>

<style scoped>
.city-roam-bar {
  position: relative;
  z-index: 10;
  padding: 10px 14px 10px 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  border-radius: var(--radius-lg);
}

.roam-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--accent-text);
  letter-spacing: 0.08em;
  white-space: nowrap;
  padding-right: 14px;
  border-right: 1px solid var(--border-subtle);
}

.pulse-dot {
  position: relative;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
}

.pulse-dot::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid var(--accent);
  opacity: 0;
  animation: ping 2.4s var(--ease-out) infinite;
}

@keyframes ping {
  0% {
    transform: scale(0.6);
    opacity: 0.8;
  }
  100% {
    transform: scale(1.8);
    opacity: 0;
  }
}

/* min-width: 0 修复移动端横向溢出（skill ux: No horizontal scroll） */
.city-pills-scroll {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 2px;
  scroll-snap-type: x proximity;
  scroll-padding-inline: 8px;
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 12px, #000 calc(100% - 28px), transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0, #000 12px, #000 calc(100% - 28px), transparent 100%);
  scrollbar-width: none;
}

.city-pills-scroll::-webkit-scrollbar {
  display: none;
}

.city-pill {
  position: relative;
  flex-shrink: 0;
  min-width: 110px;
  min-height: 52px;
  padding: 8px 13px;
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: var(--surface-2);
  text-align: left;
  scroll-snap-align: start;
  transition: background var(--dur-fast) ease, border-color var(--dur-fast) ease,
    transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base) ease;
}

.city-pill:hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
  transform: translateY(-2px);
}

.city-pill:active {
  transform: translateY(0) scale(0.98);
}

.city-pill.selected {
  background: linear-gradient(160deg, var(--accent-soft), rgba(255, 255, 255, 0.03));
  border-color: var(--accent-border);
  box-shadow: var(--shadow-glow);
}

.city-pill.selected::after {
  content: '';
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: -1px;
  height: 2px;
  border-radius: 2px;
  background: var(--accent);
}

.pill-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.city-name {
  font-size: 0.9rem;
  font-weight: 700;
}

.pill-bottom {
  margin-top: 3px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.city-vibe {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.city-pill.selected .city-vibe {
  color: var(--accent-text);
}

.city-temp {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-primary);
}

.city-temp-loading {
  font-size: 0.75rem;
  color: var(--text-muted);
}

@media (max-width: 600px) {
  .city-roam-bar {
    padding: 8px 8px 8px 12px;
    gap: 10px;
  }
  .roam-label span:last-child {
    display: none;
  }
  .roam-label {
    padding-right: 10px;
  }
}
</style>
