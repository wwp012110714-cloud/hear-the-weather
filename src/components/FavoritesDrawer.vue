<template>
  <div v-if="open" class="drawer-backdrop" @click.self="$emit('close')">
    <aside class="favorites-drawer glass-panel" aria-label="晴雨收藏歌单">
      <div class="drawer-head">
        <div>
          <h3 class="drawer-title">晴雨记忆收藏夹</h3>
          <p class="drawer-sub">封存你在不同城市实时天气下邂逅的心动旋律</p>
        </div>
        <button type="button" class="close-btn" @click="$emit('close')">×</button>
      </div>

      <div v-if="items.length === 0" class="empty-fav">
        <p>还没有封存任何晴雨曲目</p>
        <span>点击黑胶唱机或歌单右侧的红心，即可记录当下的城市天气与音乐。</span>
      </div>

      <ul v-else class="fav-list">
        <li
          v-for="fav in items"
          :key="fav.id"
          class="fav-card"
        >
          <img :src="fav.coverSm" :alt="fav.title" class="fav-cover" />
          <div class="fav-info">
            <div class="fav-song">{{ fav.title }}</div>
            <div class="fav-artist">{{ fav.artist }}</div>
            <div class="fav-stamp">
              收藏于 {{ fav.savedCity }} · {{ fav.savedWeather }}
            </div>
          </div>
          <div class="fav-actions">
            <button
              type="button"
              class="play-fav-btn"
              title="在唱机中播放"
              @click="$emit('play-fav', fav)"
            >
              播放
            </button>
            <button
              type="button"
              class="del-fav-btn"
              title="移除收藏"
              @click="$emit('remove-fav', fav.id)"
            >
              移除
            </button>
          </div>
        </li>
      </ul>
    </aside>
  </div>
</template>

<script setup>
defineProps({
  open: {
    type: Boolean,
    default: false
  },
  items: {
    type: Array,
    default: () => []
  }
})

defineEmits(['close', 'play-fav', 'remove-fav'])
</script>

<style scoped>
.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(4, 9, 18, 0.62);
  backdrop-filter: blur(6px);
  z-index: 80;
  display: flex;
  justify-content: flex-end;
}

.favorites-drawer {
  width: min(420px, 92vw);
  height: 100%;
  border-radius: 24px 0 0 24px;
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.drawer-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-subtle);
}

.drawer-title {
  margin: 0;
  font-size: 1.15rem;
}

.drawer-sub {
  margin: 4px 0 0;
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.07);
  font-size: 1.2rem;
  line-height: 1;
}

.empty-fav {
  margin: auto 0;
  text-align: center;
  padding: 24px;
  color: var(--text-secondary);
}

.empty-fav p {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0 0 6px;
}

.empty-fav span {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.fav-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.fav-card {
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: grid;
  grid-template-columns: 48px 1fr auto;
  align-items: center;
  gap: 10px;
}

.fav-cover {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  object-fit: cover;
}

.fav-info {
  min-width: 0;
}

.fav-song {
  font-size: 0.88rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fav-artist {
  font-size: 0.76rem;
  color: var(--text-secondary);
  margin-top: 2px;
}

.fav-stamp {
  margin-top: 4px;
  font-size: 0.7rem;
  color: var(--accent-text);
}

.fav-actions {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.play-fav-btn,
.del-fav-btn {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  border: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.06);
}

.play-fav-btn {
  border-color: var(--accent-border);
  color: var(--accent-text);
}
</style>
