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
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.roam-label {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--accent-text);
  letter-spacing: 0.06em;
  white-space: nowrap;
  padding-right: 10px;
  border-right: 1px solid var(--border-subtle);
}

.pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-soft);
}

.city-pills-scroll {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
  flex: 1;
}

.city-pill {
  flex-shrink: 0;
  min-width: 104px;
  padding: 7px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  background: rgba(255, 255, 255, 0.045);
  text-align: left;
  transition: all 0.2s ease;
}

.city-pill:hover {
  background: rgba(255, 255, 255, 0.11);
  transform: translateY(-1px);
}

.city-pill.selected {
  background: var(--accent-soft);
  border-color: var(--accent-border);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
}

.pill-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.city-name {
  font-size: 0.88rem;
  font-weight: 600;
}

.pill-bottom {
  margin-top: 3px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.city-vibe {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.city-pill.selected .city-vibe {
  color: var(--accent-text);
}

.city-temp {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
}

.city-temp-loading {
  font-size: 0.72rem;
  color: var(--text-muted);
}
</style>
