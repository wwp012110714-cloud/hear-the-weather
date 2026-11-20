<template>
  <Transition name="drawer">
    <div v-if="open" class="drawer-layer" @keydown.esc="$emit('close')">
      <div class="scrim" aria-hidden="true" @click="$emit('close')"></div>
      <aside ref="panel" class="drawer" role="dialog" aria-modal="true" aria-labelledby="fav-h" tabindex="-1">
        <header class="d-head">
          <h2 id="fav-h" class="d-title">收藏簿</h2>
          <button type="button" class="icon-btn" aria-label="合上收藏簿" @click="$emit('close')">
            <ChartIcon name="close" />
          </button>
        </header>
        <p class="d-note">每首歌都记下了收藏时的城市与天气。</p>
        <ol v-if="items.length" class="d-list">
          <li v-for="f in items" :key="f.id" class="d-item">
            <button type="button" class="d-play" :aria-label="`播放 ${f.title}`" @click="$emit('play-fav', f)">
              <span class="d-song">{{ f.artist }}《{{ f.title }}》</span>
              <span class="d-meta num">{{ f.savedCity }} · {{ f.savedWeather }}</span>
            </button>
            <button type="button" class="icon-btn" :aria-label="`从收藏簿移除 ${f.title}`" @click="$emit('remove-fav', f.id)">
              <ChartIcon name="close" :size="16" />
            </button>
          </li>
        </ol>
        <p v-else class="d-empty">还没有收藏。播放时点播放器右侧的星标，就会记在这里。</p>
      </aside>
    </div>
  </Transition>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import ChartIcon from './ChartIcon.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  items: { type: Array, default: () => [] }
})

defineEmits(['close', 'play-fav', 'remove-fav'])

const panel = ref(null)
let lastFocus = null

watch(
  () => props.open,
  async (v) => {
    if (v) {
      lastFocus = document.activeElement
      await nextTick()
      panel.value?.focus()
    } else if (lastFocus && lastFocus.focus) {
      lastFocus.focus()
    }
  }
)
</script>

<style scoped>
.drawer-layer {
  position: fixed;
  inset: 0;
  z-index: 50;
}

.scrim {
  position: absolute;
  inset: 0;
  background: rgba(27, 24, 20, 0.28);
}

.drawer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(420px, 92vw);
  padding: 18px 22px;
  background-color: var(--paper);
  background-image: url('../assets/paper.jpg');
  background-size: 192px 192px;
  border-left: 1px solid var(--rule);
  box-shadow: -18px 0 40px -24px rgba(27, 24, 20, 0.45);
  overflow-y: auto;
  outline: none;
}

.d-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--rule);
  padding-bottom: 8px;
}

.d-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.d-note {
  margin: 10px 0 12px;
  font-size: 0.875rem;
  color: var(--ink-3);
}

.d-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--rule-soft);
}

.d-item {
  display: flex;
  align-items: center;
  gap: 6px;
  border-bottom: 1px solid var(--rule-soft);
}

.d-play {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 9px 4px;
  text-align: left;
  transition: background-color var(--dur-fast) ease;
}

.d-play:hover {
  background: rgba(44, 90, 138, 0.06);
}

.d-song {
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.d-meta {
  font-size: 0.8125rem;
  color: var(--ink-3);
}

.d-empty {
  color: var(--ink-2);
  font-size: 0.9375rem;
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity var(--dur-base) ease;
}

.drawer-enter-active .drawer,
.drawer-leave-active .drawer {
  transition: transform 360ms var(--ease-out);
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from .drawer,
.drawer-leave-to .drawer {
  transform: translateX(100%);
}
</style>
