<template>
  <header class="app-header glass-panel">
    <div class="brand-area">
      <div class="brand-logo" aria-hidden="true">
        <svg width="34" height="34" viewBox="0 0 64 64" fill="none">
          <circle cx="39" cy="22" r="11" fill="#FBBF24" opacity="0.92" />
          <path
            d="M17 42C12.58 42 9 38.42 9 34C9 29.92 12.06 26.56 16.02 26.06C17.67 21.36 22.14 18 27.4 18C34.03 18 39.4 23.37 39.4 30C39.4 30.38 39.38 30.75 39.34 31.12C42.54 31.72 45 34.53 45 37.92C45 41.83 41.83 45 37.92 45H17V42Z"
            fill="#F8FAFC"
          />
          <rect x="21" y="49" width="3.4" height="7" rx="1.7" fill="#7DD3FC" />
          <rect x="27.5" y="47" width="3.4" height="11" rx="1.7" fill="#FCD34D" />
          <rect x="34" y="50" width="3.4" height="6" rx="1.7" fill="#7DD3FC" />
          <rect x="40.5" y="48" width="3.4" height="9" rx="1.7" fill="#7DD3FC" />
        </svg>
      </div>
      <div class="brand-titles">
        <div class="title-row">
          <h1 class="site-title">听见天气</h1>
          <span class="site-sub-badge">HEAR THE WEATHER</span>
          <span v-if="lunarText" class="lunar-seal" title="农历日期来自中国香港天文台开放数据接口">
            农历 {{ lunarText }}
          </span>
        </div>
        <p class="site-tagline">点选神州山海城市，看见实时阴晴冷暖，听见此刻天气里的旋律</p>
      </div>
    </div>

    <div class="controls-area">
      <!-- 城市实时搜索框 -->
      <div ref="searchBoxRef" class="search-wrapper">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
          <path d="M20 20L16.5 16.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <input
          v-model="keyword"
          type="text"
          class="search-input"
          placeholder="搜索任意城市（如：苏州、阿勒泰、威海…）"
          @input="handleInput"
          @focus="dropdownOpen = true"
          @keydown.enter.prevent="selectFirstResult"
          @keydown.esc="dropdownOpen = false"
        />
        <button
          v-if="keyword"
          type="button"
          class="clear-btn"
          title="清空"
          @click="clearSearch"
        >
          ×
        </button>

        <!-- 搜索联想下拉面板 -->
        <div v-if="dropdownOpen && keyword.trim()" class="search-dropdown">
          <div v-if="searching" class="dropdown-hint">正在检索城市气象站点…</div>
          <div v-else-if="searchError" class="dropdown-hint error-text">{{ searchError }}</div>
          <div v-else-if="results.length === 0" class="dropdown-hint">
            未找到匹配地点，请尝试输入城市全称（如“大理市”）
          </div>
          <ul v-else class="result-list">
            <li
              v-for="item in results"
              :key="item.id"
              class="result-item"
              @click="pickCity(item)"
            >
              <div class="result-main">
                <span class="result-name">{{ item.name }}</span>
                <span v-if="item.region" class="result-region">{{ item.region }}</span>
              </div>
              <span class="result-coords tabular-nums">
                {{ item.lat.toFixed(1) }}°N, {{ item.lon.toFixed(1) }}°E
              </span>
            </li>
          </ul>
        </div>
      </div>

      <!-- 快捷操作按钮组 -->
      <div class="action-btns">
        <button type="button" class="action-pill" title="随机漫游一座国内城市" @click="$emit('random-roam')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M16 3H21V8M4 20L21 3M21 16V21H16M15 15L21 21M4 4L9 9"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span>随机漫游</span>
        </button>

        <button
          type="button"
          class="action-pill"
          :disabled="locating"
          title="使用浏览器定位当前所在位置"
          @click="$emit('locate-me')"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3.5" stroke="currentColor" stroke-width="2" />
            <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8" />
            <path d="M12 2V4M12 20V22M2 12H4M20 12H22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
          <span>{{ locating ? '定位中…' : '定位身边' }}</span>
        </button>

        <button
          type="button"
          class="action-pill"
          :class="{ active: canvasEnabled }"
          title="开启或关闭背景动态天象粒子"
          @click="$emit('toggle-canvas')"
        >
          <span>{{ canvasEnabled ? '天象动效 · 开' : '天象动效 · 关' }}</span>
        </button>

        <button
          type="button"
          class="action-pill fav-pill"
          title="查看封存的晴雨歌单收藏"
          @click="$emit('open-favorites')"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" :fill="favoritesCount > 0 ? '#FB7185' : 'none'">
            <path
              d="M12 20.5C12 20.5 4 15.2 4 9.2C4 6.5 6.1 4.5 8.7 4.5C10.3 4.5 11.7 5.3 12 6.5C12.3 5.3 13.7 4.5 15.3 4.5C17.9 4.5 20 6.5 20 9.2C20 15.2 12 20.5 12 20.5Z"
              :stroke="favoritesCount > 0 ? '#FB7185' : 'currentColor'"
              stroke-width="2"
              stroke-linejoin="round"
            />
          </svg>
          <span>晴雨收藏</span>
          <span v-if="favoritesCount > 0" class="fav-count tabular-nums">{{ favoritesCount }}</span>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { searchCities } from '../services/api'

defineProps({
  lunarText: {
    type: String,
    default: ''
  },
  favoritesCount: {
    type: Number,
    default: 0
  },
  canvasEnabled: {
    type: Boolean,
    default: true
  },
  locating: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['select-city', 'random-roam', 'locate-me', 'toggle-canvas', 'open-favorites'])

const keyword = ref('')
const results = ref([])
const searching = ref(false)
const searchError = ref('')
const dropdownOpen = ref(false)
const searchBoxRef = ref(null)
let debounceTimer = null

function handleInput() {
  dropdownOpen.value = true
  searchError.value = ''
  if (debounceTimer) clearTimeout(debounceTimer)
  const q = keyword.value.trim()
  if (!q) {
    results.value = []
    searching.value = false
    return
  }
  searching.value = true
  debounceTimer = setTimeout(async () => {
    try {
      results.value = await searchCities(q)
    } catch {
      searchError.value = '搜索请求失败，请检查网络后重试'
    } finally {
      searching.value = false
    }
  }, 320)
}

function pickCity(city) {
  emit('select-city', city)
  dropdownOpen.value = false
  keyword.value = ''
  results.value = []
}

function selectFirstResult() {
  if (results.value.length > 0) {
    pickCity(results.value[0])
  }
}

function clearSearch() {
  keyword.value = ''
  results.value = []
  searchError.value = ''
}

function handleClickOutside(e) {
  if (searchBoxRef.value && !searchBoxRef.value.contains(e.target)) {
    dropdownOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<style scoped>
.app-header {
  position: relative;
  z-index: 30;
  padding: 16px 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  flex-wrap: wrap;
}

.brand-area {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-logo {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.site-title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.site-sub-badge {
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  color: var(--accent-text);
  background: var(--accent-soft);
  border: 1px solid var(--accent-border);
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-weight: 600;
}

.lunar-seal {
  font-family: var(--font-serif);
  font-size: 0.76rem;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid var(--border-subtle);
  padding: 2px 9px;
  border-radius: var(--radius-pill);
}

.site-tagline {
  margin: 4px 0 0;
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.controls-area {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  flex: 1;
  justify-content: flex-end;
}

.search-wrapper {
  position: relative;
  min-width: 260px;
  max-width: 340px;
  flex: 1;
}

.search-icon {
  position: absolute;
  left: 13px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 38px;
  padding: 0 32px 0 36px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background: rgba(8, 15, 28, 0.52);
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s, background 0.2s;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-input:focus {
  border-color: var(--accent-border);
  background: rgba(8, 15, 28, 0.78);
}

.clear-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  font-size: 0.95rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: rgba(11, 20, 35, 0.96);
  border: 1px solid var(--border-strong);
  border-radius: 16px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(20px);
  overflow: hidden;
  z-index: 60;
}

.dropdown-hint {
  padding: 14px 16px;
  font-size: 0.83rem;
  color: var(--text-secondary);
}

.error-text {
  color: #fda4af;
}

.result-list {
  list-style: none;
  margin: 0;
  padding: 6px;
  max-height: 280px;
  overflow-y: auto;
}

.result-item {
  padding: 9px 12px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.result-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.result-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.result-name {
  font-size: 0.9rem;
  font-weight: 600;
}

.result-region {
  font-size: 0.75rem;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 7px;
  border-radius: 999px;
}

.result-coords {
  font-size: 0.73rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.action-btns {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.action-pill {
  height: 38px;
  padding: 0 13px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.06);
  font-size: 0.82rem;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
  white-space: nowrap;
}

.action-pill:hover:not(:disabled) {
  background: var(--surface-hover);
  border-color: var(--border-strong);
}

.action-pill.active {
  border-color: var(--accent-border);
  background: var(--accent-soft);
  color: var(--accent-text);
}

.action-pill:disabled {
  opacity: 0.6;
  cursor: wait;
}

.fav-count {
  background: #fb7185;
  color: #0f172a;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 999px;
}

@media (max-width: 900px) {
  .controls-area {
    width: 100%;
    justify-content: flex-start;
  }
  .search-wrapper {
    max-width: none;
    min-width: 100%;
  }
}
</style>
