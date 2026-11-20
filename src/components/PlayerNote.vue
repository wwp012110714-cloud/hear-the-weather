<template>
  <div class="player-note" :class="{ live: track?.isLiveStream }">
    <p class="np-line">
      <span class="np-key">{{ isPlaying ? '正在播放' : track ? '待播' : '选曲中' }}</span>
      <span v-if="basis" class="np-basis">{{ basis }}</span>
    </p>

    <div v-if="loading && !track" class="np-empty">按{{ basisShort }}检索歌曲…</div>
    <div v-else-if="error && !track" class="np-empty">
      {{ error }}
      <button type="button" class="chart-btn" @click="$emit('retry')">重新检索</button>
    </div>

    <template v-else-if="track">
      <p class="np-title" :title="track.title">《{{ track.title }}》</p>
      <p class="np-artist">{{ track.artist }}</p>

      <div class="np-scale">
        <input
          class="scale-range"
          type="range"
          min="0"
          :max="duration || 30"
          step="0.1"
          :value="currentTime"
          :disabled="track.isLiveStream"
          :style="{ '--fill': `${progress * 100}%` }"
          aria-label="播放进度"
          @input="seek($event.target.value)"
        />
        <span class="np-time num">
          {{ track.isLiveStream ? '直播' : `${formatSec(currentTime)} / ${formatSec(duration || 30)}` }}
        </span>
      </div>

      <div class="np-controls">
        <button type="button" class="icon-btn" aria-label="上一首" @click="prev"><ChartIcon name="prev" /></button>
        <button
          type="button"
          class="icon-btn primary"
          :aria-label="isPlaying ? '暂停' : '播放'"
          :aria-busy="buffering ? 'true' : 'false'"
          @click="toggle"
        >
          <ChartIcon :name="isPlaying ? 'pause' : 'play'" />
        </button>
        <button type="button" class="icon-btn" aria-label="下一首" @click="next"><ChartIcon name="next" /></button>
        <span class="np-spacer"></span>
        <button
          type="button"
          class="icon-btn fav"
          :class="{ on: isFav }"
          :aria-pressed="String(isFav)"
          :aria-label="isFav ? '从收藏簿移除' : '记入收藏簿'"
          @click="$emit('toggle-favorite', track)"
        >
          <ChartIcon :name="isFav ? 'star-on' : 'star'" />
        </button>
      </div>
      <p v-if="buffering" class="np-hint">缓冲中…</p>
      <p v-if="notice" class="np-hint warn" role="status">{{ notice }}</p>
      <p v-else-if="fallbackNotice" class="np-hint" role="status">{{ fallbackNotice }}</p>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ChartIcon from './ChartIcon.vue'
import { usePlayer, formatSec } from '../composables/usePlayer'

const props = defineProps({
  favoriteIds: { type: Object, required: true },
  basis: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  fallbackNotice: { type: String, default: '' }
})

defineEmits(['toggle-favorite', 'retry'])

const { currentTrack: track, isPlaying, buffering, notice, currentTime, duration, progress, toggle, next, prev, seek } =
  usePlayer()

const isFav = computed(() => (track.value ? props.favoriteIds.has(track.value.id) : false))
const basisShort = computed(() => (props.basis ? '当前天气' : '天气'))
</script>

<style scoped>
.player-note {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.np-line {
  margin: 0 0 4px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  font-size: 0.875rem;
}

.np-key {
  color: var(--front);
  font-weight: 700;
  letter-spacing: 0.08em;
}

.np-basis {
  color: var(--ink-3);
  font-size: 0.8125rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.np-title {
  margin: 0;
  font-size: 1.375rem;
  line-height: 1.3;
  color: var(--front);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.np-artist {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--ink-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.np-scale {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}

.np-time {
  font-size: 0.8125rem;
  color: var(--ink-2);
}

.np-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

.np-spacer {
  flex: 1;
}

.fav.on {
  color: var(--front);
}

.np-empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 0 2px;
  color: var(--ink-2);
  font-size: 0.9375rem;
}

.np-hint {
  margin: 4px 0 0;
  font-size: 0.8125rem;
  color: var(--ink-3);
  line-height: 1.5;
}

.np-hint.warn {
  color: var(--front);
}
</style>
