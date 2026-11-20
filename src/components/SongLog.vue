<template>
  <div class="song-log">
    <p v-if="caption" class="log-caption">{{ caption }}</p>
    <ol v-if="tracks.length" class="log-list" :aria-busy="loading ? 'true' : 'false'">
      <li v-for="(t, i) in tracks.slice(0, limit)" :key="t.id">
        <button
          type="button"
          class="log-row"
          :class="{ active: currentTrack?.id === t.id }"
          :aria-current="currentTrack?.id === t.id ? 'true' : undefined"
          @click="play(t)"
        >
          <span class="log-no num">{{ String(i + 1).padStart(2, '0') }}</span>
          <span class="log-title">{{ t.artist }}《{{ t.title }}》</span>
          <span class="log-state">{{ currentTrack?.id === t.id ? (isPlaying ? '播放中' : '已选') : '' }}</span>
        </button>
      </li>
    </ol>
    <p v-else-if="loading" class="log-empty">记录中…</p>
    <p v-else class="log-empty">这一时次没有检索到可试听的歌曲。</p>
  </div>
</template>

<script setup>
import { usePlayer } from '../composables/usePlayer'

defineProps({
  tracks: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  caption: { type: String, default: '' },
  limit: { type: Number, default: 7 }
})

const { currentTrack, isPlaying, play } = usePlayer()
</script>

<style scoped>
.song-log {
  min-width: 0;
}

.log-caption {
  margin: 0 0 4px;
  font-size: 0.8125rem;
  color: var(--ink-3);
  letter-spacing: 0.06em;
}

.log-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--rule);
}

.log-list li {
  border-bottom: 1px solid var(--rule-soft);
}

.log-row {
  width: 100%;
  display: grid;
  grid-template-columns: 2.2em minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 6px;
  padding: 6px 2px;
  text-align: left;
  font-size: 0.9375rem;
  line-height: 1.4;
  color: var(--ink);
  transition:
    background-color var(--dur-fast) ease,
    color var(--dur-fast) ease;
}

.log-row:hover {
  background: rgba(44, 90, 138, 0.06);
}

.log-no {
  color: var(--ink-3);
  font-size: 0.8125rem;
}

.log-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.log-state {
  font-size: 0.75rem;
  color: var(--front);
}

.log-row.active {
  color: var(--front);
  background: var(--front-wash);
}

.log-row.active .log-no {
  color: var(--front);
}

.log-empty {
  margin: 0;
  padding: 8px 0;
  color: var(--ink-3);
  font-size: 0.875rem;
  border-top: 1px solid var(--rule);
}
</style>
