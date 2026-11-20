<template>
  <div class="app-root" :data-sky="activeSkyTheme">
    <!-- 背景天象粒子画布 -->
    <WeatherCanvas :sky-theme="activeSkyTheme" :enabled="canvasEnabled" />

    <!-- 主内容容器 -->
    <div class="page-wrapper">
      <AppHeader
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
        :cities="roamBarCities"
        :current-city="currentCity"
        :snapshots="citySnapshots"
        @select-city="handleSelectCity"
      />

      <!-- 定位或全局通知横幅 -->
      <div v-if="toastMessage" class="toast-banner glass-panel">
        <span>{{ toastMessage }}</span>
        <button type="button" class="toast-close" @click="toastMessage = ''">知道了</button>
      </div>

      <!-- 双栏核心交互工作区：左侧看天气，右侧听天气 -->
      <main class="studio-grid">
        <WeatherPanel
          :city="currentCity"
          :weather="weatherData"
          :loading="weatherLoading"
          :error="weatherError"
          :selected-day-index="selectedDayIndex"
          @retry="loadCityWeatherAndMusic"
          @select-day="handleSelectDay"
        />

        <MusicRadioPanel
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
      <footer class="site-footer glass-panel">
        <div class="api-status-list">
          <span class="status-item">
            <i class="status-dot" :class="{ ok: !weatherError }"></i>
            Open-Meteo & MET Norway 实时气象与空气质量 API
          </span>
          <span class="status-item">
            <i class="status-dot" :class="{ ok: !musicError }"></i>
            Apple iTunes & Radio Browser 音乐电台 API
          </span>
          <span class="status-item">
            <i class="status-dot" :class="{ ok: Boolean(lunarText) }"></i>
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
  background:
    radial-gradient(circle at 80% 10%, var(--sky-glow), transparent 45%),
    linear-gradient(168deg, var(--sky-top) 0%, var(--sky-mid) 52%, var(--sky-bottom) 100%);
  transition: background 0.8s ease;
}

.page-wrapper {
  position: relative;
  z-index: 5;
  max-width: 1360px;
  margin: 0 auto;
  padding: 18px 20px 28px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.toast-banner {
  padding: 10px 16px;
  border-radius: 14px;
  border-color: var(--accent-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.84rem;
  color: var(--accent-text);
}

.toast-close {
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--accent-border);
  background: transparent;
  font-size: 0.76rem;
}

.studio-grid {
  display: grid;
  grid-template-columns: minmax(360px, 5fr) minmax(420px, 7fr);
  gap: 16px;
  align-items: start;
}

.site-footer {
  padding: 13px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 0.77rem;
  color: var(--text-secondary);
}

.api-status-list {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.status-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #f59e0b;
  display: inline-block;
}

.status-dot.ok {
  background: #34d399;
}

.footer-note {
  color: var(--text-muted);
}

@media (max-width: 1024px) {
  .studio-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .page-wrapper {
    padding: 12px 12px 22px;
  }
}
</style>
