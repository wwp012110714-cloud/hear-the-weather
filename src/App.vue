<template>
  <div class="app-root" :data-sky="activeSkyTheme">
    <!-- 天气极光层（Aurora UI）：颜色随实时天象变化 -->
    <div class="aurora-layer" aria-hidden="true">
      <span class="aurora-blob blob-a"></span>
      <span class="aurora-blob blob-b"></span>
      <span class="aurora-blob blob-c"></span>
      <span class="aurora-grain"></span>
    </div>

    <!-- 背景天象粒子画布 -->
    <WeatherCanvas :sky-theme="activeSkyTheme" :enabled="canvasEnabled" />

    <!-- 主内容容器 -->
    <div class="page-wrapper">
      <AppHeader
        class="reveal"
        style="--i: 0"
        :lunar-text="lunarText"
        :favorites-count="favorites.length"
        :canvas-enabled="canvasEnabled"
        :locating="locating"
        @select-city="handleSelectCity"
        @random-roam="handleRandomRoam"
        @locate-me="handleLocateMe"
        @toggle-canvas="canvasEnabled = !canvasEnabled"
        @open-favorites="favoritesOpen = true"
      />

      <!-- 城市实时天气漫游条 -->
      <CityRoamBar
        class="reveal"
        style="--i: 1"
        :cities="roamBarCities"
        :current-city="currentCity"
        :snapshots="citySnapshots"
        @select-city="handleSelectCity"
      />

      <!-- 定位或全局通知横幅 -->
      <div v-if="toastMessage" class="toast-banner glass-panel" role="status">
        <span>{{ toastMessage }}</span>
        <button type="button" class="toast-close" @click="toastMessage = ''">知道了</button>
      </div>

      <!-- 双栏核心交互工作区：左侧看天气，右侧听天气 -->
      <main class="studio-grid">
        <WeatherPanel
          class="reveal"
          style="--i: 2"
          :city="currentCity"
          :weather="weatherData"
          :loading="weatherLoading"
          :error="weatherError"
          :selected-day-index="selectedDayIndex"
          @retry="loadCityWeatherAndMusic"
          @select-day="handleSelectDay"
        />

        <MusicRadioPanel
          class="reveal"
          style="--i: 3"
          :profile="musicProfile"
          :tracks="tracks"
          :loading="musicLoading"
          :error="musicError"
          :genre-mode="genreMode"
          :custom-query-active="customQueryActive"
          :custom-applied-term="customAppliedTerm"
          :favorite-ids="favoriteIds"
          :external-track="externalTrack"
          :ambient-running="ambientRunning"
          :ambient-mix="ambientMix"
          :fallback-notice="musicFallbackNotice"
          @change-genre="handleGenreChange"
          @custom-search="handleCustomSongSearch"
          @reset-custom="handleResetCustom"
          @next-batch="handleNextBatch"
          @retry="loadMusicOnly"
          @toggle-favorite="handleToggleFavorite"
          @toggle-ambient="handleToggleAmbient"
          @update-ambient-mix="handleUpdateAmbientMix"
          @reset-ambient-preset="handleResetAmbientPreset"
        />
      </main>

      <!-- 底部公共 API 实时数据源说明 -->
      <footer class="site-footer glass-panel reveal" style="--i: 4">
        <div class="api-status-list">
          <span class="status-item">
            <i class="status-dot" :class="{ ok: !weatherError }" aria-hidden="true"></i>
            Open-Meteo & MET Norway 实时气象与空气质量 API
          </span>
          <span class="status-item">
            <i class="status-dot" :class="{ ok: !musicError }" aria-hidden="true"></i>
            Apple iTunes & Radio Browser 音乐电台 API
          </span>
          <span class="status-item">
            <i class="status-dot" :class="{ ok: Boolean(lunarText) }" aria-hidden="true"></i>
            中国香港天文台农历开放数据 API
          </span>
        </div>
        <div class="footer-note">
          听见天气 · 所有气象指标与推荐歌单均由 GitHub Public APIs 动态实时获取
        </div>
      </footer>
    </div>

    <!-- 晴雨记忆收藏抽屉 -->
    <FavoritesDrawer
      :open="favoritesOpen"
      :items="favorites"
      @close="favoritesOpen = false"
      @play-fav="handlePlayFavorite"
      @remove-fav="handleRemoveFavorite"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import AppHeader from './components/AppHeader.vue'
import CityRoamBar from './components/CityRoamBar.vue'
import WeatherCanvas from './components/WeatherCanvas.vue'
import WeatherPanel from './components/WeatherPanel.vue'
import MusicRadioPanel from './components/MusicRadioPanel.vue'
import FavoritesDrawer from './components/FavoritesDrawer.vue'

import {
  FEATURED_CITIES,
  ROAM_CITY_POOL,
  getWeatherMeta,
  deriveMusicProfile
} from './utils/weatherMap'
import {
  fetchBatchCityWeather,
  fetchCityFullWeather,
  fetchLunarDate,
  fetchWeatherMusic,
  fetchDomesticMusicStations
} from './services/api'
import { WeatherSoundscape } from './utils/soundscape'

const FAVORITES_STORAGE_KEY = 'hear_the_weather_favorites_v1'

// 城市与漫游状态
const roamBarCities = ref([...FEATURED_CITIES])
const currentCity = ref(FEATURED_CITIES[0])
const citySnapshots = ref({})
const lunarText = ref('')
const canvasEnabled = ref(true)
const locating = ref(false)
const toastMessage = ref('')

// 气象状态
const weatherData = ref(null)
const weatherLoading = ref(false)
const weatherError = ref('')
const selectedDayIndex = ref(null)

// 音乐电台状态
const tracks = ref([])
const musicLoading = ref(false)
const musicError = ref('')
const musicFallbackNotice = ref('')
const genreMode = ref('auto')
const batchIndex = ref(0)
const customQueryActive = ref(false)
const customAppliedTerm = ref('')
const externalTrack = ref(null)

// 环境白噪音合成器状态
const soundscape = new WeatherSoundscape()
const ambientRunning = ref(false)
const ambientMix = ref({ rain: 0, wind: 20, hearth: 0, chimes: 25 })

// 收藏夹状态
const favoritesOpen = ref(false)
const favorites = ref(loadFavoritesFromStorage())
const favoriteIds = computed(() => new Set(favorites.value.map((f) => f.id)))

// 当前生效的天气（实时 或 用户点选的 7 日预报某一天）
const effectiveWeather = computed(() => {
  if (!weatherData.value) {
    return { code: 0, isDay: 1, temp: 18, windSpeed: 6, precipitation: 0 }
  }
  if (selectedDayIndex.value != null && weatherData.value.daily7?.[selectedDayIndex.value]) {
    const d = weatherData.value.daily7[selectedDayIndex.value]
    return {
      code: d.code,
      isDay: 1,
      temp: (d.maxTemp + d.minTemp) / 2,
      windSpeed: d.windMax,
      precipitation: d.popMax > 40 ? 3 : 0
    }
  }
  return weatherData.value.current
})

const activeSkyTheme = computed(() => {
  const ew = effectiveWeather.value
  return getWeatherMeta(ew.code, ew.isDay, ew.temp).skyTheme
})

const musicProfile = computed(() => {
  const ew = effectiveWeather.value
  return deriveMusicProfile({
    cityName: currentCity.value.name,
    code: ew.code,
    isDay: ew.isDay,
    temp: ew.temp,
    windSpeed: ew.windSpeed,
    precipitation: ew.precipitation,
    genreMode: genreMode.value,
    batchIndex: batchIndex.value
  })
})

function loadFavoritesFromStorage() {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveFavoritesToStorage() {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites.value))
  } catch {
    // 忽略无痕模式存储限制
  }
}

function showToast(msg) {
  toastMessage.value = msg
  setTimeout(() => {
    if (toastMessage.value === msg) toastMessage.value = ''
  }, 4500)
}

let requestSeq = 0

async function loadCityWeatherAndMusic() {
  const seq = ++requestSeq
  weatherLoading.value = true
  weatherError.value = ''
  selectedDayIndex.value = null

  try {
    const data = await fetchCityFullWeather(currentCity.value.lat, currentCity.value.lon)
    if (seq !== requestSeq) return
    weatherData.value = data

    // 同步更新顶栏漫游胶囊上的该城市实时温度
    citySnapshots.value = {
      ...citySnapshots.value,
      [currentCity.value.id]: {
        temp: Math.round(data.current.temp),
        code: data.current.code,
        isDay: data.current.isDay
      }
    }

    // 同步该城市实时天气对应的环境混音比例
    syncAmbientToWeather()
    await loadMusicOnly(seq)
  } catch (err) {
    if (seq !== requestSeq) return
    weatherError.value = err?.message || '获取城市实时气象失败，请检查网络连接后重试'
  } finally {
    if (seq === requestSeq) {
      weatherLoading.value = false
    }
  }
}

async function loadMusicOnly(parentSeq = requestSeq) {
  musicLoading.value = true
  musicError.value = ''
  musicFallbackNotice.value = ''
  try {
    let list = []
    if (!customQueryActive.value && genreMode.value === 'cnradio') {
      const ew = effectiveWeather.value
      const meta = getWeatherMeta(ew.code, ew.isDay, ew.temp)
      list = await fetchDomesticMusicStations(meta.category, ew.isDay)
    } else {
      const queries = customQueryActive.value
        ? [customAppliedTerm.value]
        : musicProfile.value.queries
      list = await fetchWeatherMusic(queries, 7, {
        allowInstrumental: genreMode.value === 'pure' || customQueryActive.value
      })
    }
    if (parentSeq !== requestSeq) return
    tracks.value = list
  } catch (err) {
    if (parentSeq !== requestSeq) return
    // 歌曲库在当前网络下全部不可达时，自动降级到国内 FM 音乐台 MP3 直播，保证一定有歌可听
    if (genreMode.value !== 'cnradio') {
      try {
        const ew = effectiveWeather.value
        const meta = getWeatherMeta(ew.code, ew.isDay, ew.temp)
        const stations = await fetchDomesticMusicStations(meta.category, ew.isDay)
        if (parentSeq !== requestSeq) return
        if (stations.length) {
          tracks.value = stations
          musicFallbackNotice.value = '当前网络连不上在线歌曲库，已自动切换为国内FM音乐台（MP3 全长直播）'
          return
        }
      } catch {
        // 两者都失败时展示错误
      }
    }
    if (parentSeq !== requestSeq) return
    musicError.value = err?.message || '获取推荐歌单失败，请点击重试'
  } finally {
    if (parentSeq === requestSeq) {
      musicLoading.value = false
    }
  }
}

function syncAmbientToWeather() {
  const preset = musicProfile.value.ambientPreset
  ambientMix.value = { ...preset }
  soundscape.setMix(ambientMix.value)
}

function handleSelectCity(city) {
  const exists = roamBarCities.value.some((c) => c.id === city.id)
  if (!exists) {
    roamBarCities.value = [city, ...roamBarCities.value.slice(0, 11)]
  }
  currentCity.value = city
  customQueryActive.value = false
  batchIndex.value = 0
  loadCityWeatherAndMusic()
}

function handleRandomRoam() {
  const candidates = ROAM_CITY_POOL.filter((c) => c.id !== currentCity.value.id)
  const pick = candidates[Math.floor(Math.random() * candidates.length)]
  if (pick) {
    handleSelectCity(pick)
    showToast(`已随机漫游至「${pick.name} · ${pick.vibe || pick.region}」，正在为你调频当地实时天气与旋律`)
  }
}

function handleLocateMe() {
  if (!navigator.geolocation) {
    showToast('当前浏览器不支持地理定位，可直接通过搜索框输入所在城市')
    return
  }
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locating.value = false
      const myCity = {
        id: 'my-location',
        name: '我的当前位置',
        region: '实时定位',
        vibe: '身边此刻',
        lat: pos.coords.latitude,
        lon: pos.coords.longitude
      }
      handleSelectCity(myCity)
    },
    () => {
      locating.value = false
      showToast('未能获取定位权限，你可在顶部搜索框直接输入任意城市名称')
    },
    { timeout: 8000 }
  )
}

function handleSelectDay(idx) {
  selectedDayIndex.value = idx
  customQueryActive.value = false
  batchIndex.value = 0
  syncAmbientToWeather()
  loadMusicOnly()
}

function handleGenreChange(mode) {
  genreMode.value = mode
  customQueryActive.value = false
  batchIndex.value = 0
  loadMusicOnly()
}

function handleCustomSongSearch(term) {
  customAppliedTerm.value = term
  customQueryActive.value = true
  loadMusicOnly()
}

function handleResetCustom() {
  customQueryActive.value = false
  customAppliedTerm.value = ''
  loadMusicOnly()
}

function handleNextBatch() {
  if (customQueryActive.value) {
    loadMusicOnly()
    return
  }
  batchIndex.value += 1
  loadMusicOnly()
}

async function handleToggleAmbient() {
  if (ambientRunning.value) {
    soundscape.stop()
    ambientRunning.value = false
  } else {
    soundscape.setMix(ambientMix.value)
    await soundscape.start()
    ambientRunning.value = true
  }
}

function handleUpdateAmbientMix(newMix) {
  ambientMix.value = newMix
  soundscape.setMix(newMix)
}

function handleResetAmbientPreset() {
  syncAmbientToWeather()
}

function handleToggleFavorite(track) {
  if (!track) return
  const idx = favorites.value.findIndex((f) => f.id === track.id)
  if (idx >= 0) {
    favorites.value.splice(idx, 1)
  } else {
    const ew = effectiveWeather.value
    const meta = getWeatherMeta(ew.code, ew.isDay, ew.temp)
    favorites.value.unshift({
      ...track,
      savedCity: currentCity.value.name,
      savedWeather: `${Math.round(ew.temp)}°C ${meta.short}`
    })
  }
  saveFavoritesToStorage()
}

function handleRemoveFavorite(id) {
  favorites.value = favorites.value.filter((f) => f.id !== id)
  saveFavoritesToStorage()
}

function handlePlayFavorite(fav) {
  externalTrack.value = { ...fav, _ts: Date.now() }
  favoritesOpen.value = false
}

onMounted(async () => {
  // 并行加载：当前城市完整天气与歌单 + 顶栏 10 城实时温度快照 + 今日农历
  loadCityWeatherAndMusic()

  fetchBatchCityWeather(FEATURED_CITIES)
    .then((snaps) => {
      citySnapshots.value = { ...citySnapshots.value, ...snaps }
    })
    .catch(() => {})

  fetchLunarDate()
    .then((lunar) => {
      lunarText.value = lunar
    })
    .catch(() => {})
})

onBeforeUnmount(() => {
  soundscape.dispose()
})
</script>

<style scoped>
.app-root {
  position: relative;
  min-height: 100vh;
  overflow-x: clip;
  background:
    radial-gradient(120% 70% at 85% -10%, var(--sky-glow), transparent 55%),
    linear-gradient(172deg, var(--sky-top) 0%, var(--sky-mid) 46%, var(--night-base) 100%);
  transition: background var(--dur-slow) ease;
}

/* ---------- 极光层 ---------- */
.aurora-layer {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.aurora-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.9;
  transition: background 1.2s ease;
  will-change: transform;
}

.blob-a {
  width: 52vw;
  height: 52vw;
  max-width: 760px;
  max-height: 760px;
  top: -18vw;
  left: -12vw;
  background: radial-gradient(circle, var(--aurora-a), transparent 68%);
  animation: auroraDrift 26s ease-in-out infinite alternate;
}

.blob-b {
  width: 46vw;
  height: 46vw;
  max-width: 680px;
  max-height: 680px;
  top: 18%;
  right: -14vw;
  background: radial-gradient(circle, var(--aurora-b), transparent 68%);
  animation: auroraDrift 32s ease-in-out infinite alternate-reverse;
}

.blob-c {
  width: 40vw;
  height: 40vw;
  max-width: 600px;
  max-height: 600px;
  bottom: -16vw;
  left: 28%;
  background: radial-gradient(circle, var(--sky-glow), transparent 70%);
  animation: auroraDrift 38s ease-in-out infinite alternate;
}

/* 细颗粒噪点，避免大面积渐变出现色带 */
.aurora-grain {
  position: absolute;
  inset: 0;
  opacity: 0.06;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
}

@keyframes auroraDrift {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(6vw, 4vh, 0) scale(1.12);
  }
  100% {
    transform: translate3d(-4vw, 8vh, 0) scale(0.94);
  }
}

/* ---------- 布局 ---------- */
.page-wrapper {
  position: relative;
  z-index: 5;
  max-width: 1360px;
  margin: 0 auto;
  padding: var(--space-5) var(--space-5) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.toast-banner {
  padding: 10px 16px;
  border-radius: var(--radius-md);
  border-color: var(--accent-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.875rem;
  color: var(--accent-text);
  animation: riseIn var(--dur-base) var(--ease-out) both;
}

.toast-close {
  min-height: 32px;
  padding: 4px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent-border);
  background: transparent;
  font-size: 0.8rem;
  transition: background var(--dur-fast) ease;
}

.toast-close:hover {
  background: var(--accent-soft);
}

.studio-grid {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  gap: var(--space-4);
  align-items: start;
}

.studio-grid > * {
  min-width: 0;
}

/* ---------- 页脚 ---------- */
.site-footer {
  padding: 14px 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 0.8rem;
  color: var(--text-secondary);
  border-radius: var(--radius-lg);
}

.api-status-list {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
}

.status-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--warning);
  display: inline-block;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.18);
}

.status-dot.ok {
  background: var(--success);
  box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.18), 0 0 10px rgba(52, 211, 153, 0.6);
}

.footer-note {
  color: var(--text-muted);
}

@media (max-width: 1024px) {
  .studio-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 600px) {
  .page-wrapper {
    padding: 12px 12px 24px;
    gap: 12px;
  }
  .aurora-blob {
    filter: blur(60px);
  }
  .blob-a,
  .blob-b,
  .blob-c {
    width: 90vw;
    height: 90vw;
  }
}
</style>
