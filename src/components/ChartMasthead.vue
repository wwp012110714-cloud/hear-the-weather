<template>
  <header class="masthead">
    <div class="brand">
      <svg class="mark" width="30" height="30" viewBox="-15 -15 30 30" aria-hidden="true">
        <line x1="4" y1="-4" x2="13" y2="-13" />
        <line x1="13" y1="-13" x2="8" y2="-14.5" />
        <line x1="10.2" y1="-10.2" x2="5.6" y2="-11.6" />
        <circle r="6" class="ring" />
        <path d="M0 0V-6A6 6 0 0 1 0 6Z" class="fill" />
      </svg>
      <h1 class="name">听见天气</h1>
      <span class="name-en">Hear the Weather</span>
    </div>

    <div class="views" role="group" aria-label="图式">
      <button
        v-for="v in VIEWS"
        :key="v.id"
        type="button"
        class="view-btn"
        :class="{ on: view === v.id }"
        :aria-pressed="String(view === v.id)"
        :title="v.hint"
        @click="$emit('set-view', v.id)"
      >
        {{ v.label }}
      </button>
      <button
        type="button"
        class="tour-btn"
        :class="{ on: touring }"
        :aria-pressed="String(touring)"
        :title="touring ? '停止自动轮换图式' : '每 9 秒自动轮换三种图式'"
        @click="$emit('toggle-tour')"
      >
        <span>轮换</span>
        <span v-if="touring" :key="view" class="tour-meter" aria-hidden="true"></span>
      </button>
    </div>

    <div ref="searchBox" class="search">
      <label class="sr-only" for="city-q">搜索城市</label>
      <span class="s-icon" aria-hidden="true"><ChartIcon name="search" :size="16" /></span>
      <input
        id="city-q"
        v-model="keyword"
        type="search"
        autocomplete="off"
        placeholder="搜索城市，如 大理"
        role="combobox"
        :aria-expanded="String(open && keyword.trim().length > 0)"
        aria-controls="city-results"
        @input="onInput"
        @focus="open = true"
        @keydown.enter.prevent="pickFirst"
        @keydown.esc="open = false"
      />
      <ul v-if="open && keyword.trim()" id="city-results" class="results" role="listbox">
        <li v-if="searching" class="r-note">检索中…</li>
        <li v-else-if="searchError" class="r-note">{{ searchError }}</li>
        <li v-else-if="!results.length" class="r-note">没有找到「{{ keyword.trim() }}」，换个写法试试</li>
        <li v-for="c in results" v-else :key="c.id" role="option" aria-selected="false">
          <button type="button" class="r-item" @click="pick(c)">
            <span>{{ c.name }}</span>
            <span class="r-sub">{{ c.region }}</span>
          </button>
        </li>
      </ul>
    </div>

    <div class="tools">
      <button type="button" class="chart-btn" :disabled="locating" @click="$emit('locate-me')">
        <ChartIcon name="locate" :size="16" />{{ locating ? '定位中' : '定位' }}
      </button>
      <button type="button" class="chart-btn" @click="$emit('random-roam')">
        <ChartIcon name="roam" :size="16" />随机一站
      </button>
      <button type="button" class="chart-btn" @click="$emit('open-favorites')">
        <ChartIcon name="star" :size="16" />收藏簿<span class="count num">{{ favoritesCount }}</span>
      </button>
    </div>
  </header>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import ChartIcon from './ChartIcon.vue'
import { searchCities } from '../services/api'

defineProps({
  view: { type: String, default: 'map' },
  touring: { type: Boolean, default: false },
  favoritesCount: { type: Number, default: 0 },
  locating: { type: Boolean, default: false }
})

const emit = defineEmits(['set-view', 'toggle-tour', 'select-city', 'random-roam', 'locate-me', 'open-favorites'])

const VIEWS = [
  { id: 'map', label: '填图', hint: '各城测站填在等温线图上' },
  { id: 'station', label: '站点', hint: '放大当前城市的站点符号' },
  { id: 'trace', label: '自记', hint: '24 小时温度自记曲线' }
]

const keyword = ref('')
const results = ref([])
const searching = ref(false)
const searchError = ref('')
const open = ref(false)
const searchBox = ref(null)
let timer = null

function onInput() {
  open.value = true
  searchError.value = ''
  if (timer) clearTimeout(timer)
  const q = keyword.value.trim()
  if (!q) {
    results.value = []
    searching.value = false
    return
  }
  searching.value = true
  timer = setTimeout(async () => {
    try {
      results.value = await searchCities(q)
    } catch {
      searchError.value = '城市检索失败，检查网络后再试'
    } finally {
      searching.value = false
    }
  }, 320)
}

function pick(c) {
  emit('select-city', c)
  open.value = false
  keyword.value = ''
  results.value = []
}

function pickFirst() {
  if (results.value.length) pick(results.value[0])
}

function outside(e) {
  if (searchBox.value && !searchBox.value.contains(e.target)) open.value = false
}

onMounted(() => document.addEventListener('mousedown', outside))
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', outside)
  if (timer) clearTimeout(timer)
})
</script>

<style scoped>
.masthead {
  height: var(--masthead-h);
  display: grid;
  grid-template-columns: auto auto minmax(180px, 300px) auto;
  align-items: center;
  gap: 24px;
  padding: 0 var(--gutter);
  border-bottom: 1px solid var(--rule);
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 10px;
  white-space: nowrap;
}

.mark {
  align-self: center;
  overflow: visible;
}

.mark line {
  stroke: var(--ink);
  stroke-width: 1.4;
}

.mark .ring {
  fill: var(--paper);
  stroke: var(--front);
  stroke-width: 1.4;
}

.mark .fill {
  fill: var(--front);
}

.name {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  line-height: 1;
}

.name-en {
  font-size: 0.8125rem;
  color: var(--ink-3);
  letter-spacing: 0.04em;
}

.views {
  justify-self: center;
  display: flex;
  align-items: stretch;
  border: 1px solid var(--rule);
  border-radius: 2px;
}

.view-btn,
.tour-btn {
  position: relative;
  min-height: 34px;
  padding: 4px 16px;
  font-size: 0.9375rem;
  letter-spacing: 0.1em;
  transition:
    background-color var(--dur-fast) ease,
    color var(--dur-fast) ease;
}

.view-btn + .view-btn,
.tour-btn {
  border-left: 1px solid var(--rule-soft);
}

.view-btn:hover,
.tour-btn:hover {
  background: var(--paper-lift);
}

.view-btn.on {
  color: var(--paper);
  background: var(--ink);
}

.tour-btn {
  font-size: 0.8125rem;
  color: var(--ink-2);
  overflow: hidden;
}

.tour-btn.on {
  color: var(--front);
}

/* 轮换计时：底边一条暖锋红细线在 9 秒内走满 */
.tour-meter {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  width: 100%;
  background: var(--front);
  transform-origin: left;
  animation: meter 9s linear both;
}

@keyframes meter {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

.search {
  position: relative;
}

.s-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--ink-3);
  display: grid;
}

.search input {
  width: 100%;
  min-height: 36px;
  padding: 4px 10px 4px 32px;
  border: 1px solid var(--rule);
  border-radius: 2px;
  background: var(--paper-lift);
  font-size: 0.9375rem;
  outline: none;
  transition: border-color var(--dur-fast) ease;
}

.search input:focus {
  border-color: var(--chart);
  box-shadow: 0 0 0 1px var(--chart);
}

.results {
  position: absolute;
  z-index: 30;
  left: 0;
  right: 0;
  top: calc(100% + 4px);
  margin: 0;
  padding: 4px 0;
  list-style: none;
  background: var(--paper-lift);
  border: 1px solid var(--rule);
  box-shadow: 0 10px 24px -12px rgba(27, 24, 20, 0.35);
  max-height: 320px;
  overflow: auto;
}

.r-item {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 12px;
  text-align: left;
  font-size: 0.9375rem;
}

.r-item:hover,
.r-item:focus-visible {
  background: rgba(44, 90, 138, 0.08);
}

.r-sub {
  color: var(--ink-3);
  font-size: 0.8125rem;
}

.r-note {
  padding: 8px 12px;
  font-size: 0.875rem;
  color: var(--ink-3);
}

.tools {
  display: flex;
  gap: 8px;
  justify-self: end;
}

.count {
  margin-left: 2px;
  color: var(--front);
}

@media (max-width: 1180px) {
  .name-en {
    display: none;
  }
  .masthead {
    gap: 14px;
  }
}

@media (max-width: 900px) {
  .masthead {
    height: auto;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      'brand tools'
      'search search'
      'views views';
    padding: 10px 14px;
    gap: 10px;
  }
  .brand {
    grid-area: brand;
  }
  .tools {
    grid-area: tools;
  }
  .search {
    grid-area: search;
  }
  .views {
    grid-area: views;
    justify-self: stretch;
  }
  .view-btn,
  .tour-btn {
    flex: 1;
  }
  .tools .chart-btn {
    padding: 4px 8px;
    font-size: 0;
    gap: 0;
  }
  .tools .chart-btn .count {
    font-size: 0.8125rem;
    margin-left: 4px;
  }
}
</style>
