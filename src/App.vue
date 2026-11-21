<template>
  <div class="app">
    <a class="skip" href="#sheet">跳到天气图</a>

    <ChartMasthead
      :view="view"
      :touring="touring"
      :favorites-count="favorites.length"
      :locating="locating"
      @set-view="handleSetView"
      @toggle-tour="toggleTour"
      @select-city="handleSelectCity"
      @random-roam="handleRandomRoam"
      @locate-me="handleLocateMe"
      @open-favorites="favoritesOpen = true"
    />

    <main class="sheet-wrap">
      <p class="sheet-title">
        <span>地面填图</span>
        <span class="num">{{ chartDate }}</span>
        <span v-if="lunarText">农历 {{ lunarText }}</span>
        <span class="sheet-src">数据：Open-Meteo · MET Norway · iTunes · Radio Browser</span>
      </p>

      <p v-if="toastMessage" class="sheet-toast" role="status">
        <span>附注：{{ toastMessage }}</span>
        <button type="button" class="chart-btn" @click="toastMessage = ''">知道了</button>
      </p>

      <div id="sheet" class="sheet" :class="{ compact }" tabindex="-1">
        <Transition name="sheet-view" mode="out-in">
          <component
            :is="viewComponent"
            :key="view"
            v-bind="viewProps"
            @select-city="handleSelectCity"
            @toggle-favorite="handleToggleFavorite"
            @retry="loadCityWeatherAndMusic"
            @retry-music="loadMusicOnly"
          />
        </Transition>
      </div>
    </main>

    <section class="below">
      <ForecastTable
        :days="weatherCityId === currentCity.id ? weatherData?.daily7 || [] : []"
        :selected="selectedDayIndex"
        :loading="weatherLoading"
        @select-day="handleSelectDay"
      />
      <RadioSettings
        :profile="musicProfile"
        :genre-mode="genreMode"
        :custom-active="customQueryActive"
        :custom-term="customAppliedTerm"
        :loading="musicLoading"
        :ambient-running="ambientRunning"
        :ambient-mix="ambientMix"
        @change-genre="handleGenreChange"
        @custom-search="handleCustomSongSearch"
        @reset-custom="handleResetCustom"
        @next-batch="handleNextBatch"
        @toggle-ambient="handleToggleAmbient"
        @update-ambient-mix="handleUpdateAmbientMix"
        @reset-ambient-preset="handleResetAmbientPreset"
      />
    </section>

    <footer class="colophon">
      <p>
        气象：Open-Meteo / MET Norway（自动择快）· 空气质量：Open-Meteo Air Quality · 农历：香港天文台 ·
        歌曲：Apple iTunes Search，备用 Deezer · 直播：Radio Browser。全部来自 GitHub public-apis 目录，实时请求。
      </p>
      <p>等温线由各测站实况气温插值绘出，间隔 4°C；站点符号按地面填图惯例：圈内涂黑表示云量，风羽指向来风方向。</p>
    </footer>

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
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import ChartMasthead from './components/ChartMasthead.vue'
import ViewMap from './components/ViewMap.vue'
import ViewStation from './components/ViewStation.vue'
import ViewTrace from './components/ViewTrace.vue'
import ForecastTable from './components/ForecastTable.vue'
import RadioSettings from './components/RadioSettings.vue'
import FavoritesDrawer from './components/FavoritesDrawer.vue'

import { FEATURED_CITIES, ROAM_CITY_POOL, getWeatherMeta, deriveMusicProfile } from './utils/weatherMap'
import {
  fetchBatchCityWeather,
  fetchCityFullWeather,
  fetchLunarDate,
  fetchWeatherMusic,
  fetchDomesticMusicStations
} from './services/api'
import { WeatherSoundscape } from './utils/soundscape'
import { usePlayer } from './composables/usePlayer'

const FAVORITES_STORAGE_KEY = 'hear_the_weather_favorites_v1'
const TOUR_MS = 9000
const VIEW_ORDER = ['map', 'station', 'trace']

const player = usePlayer()

// 图式与自动轮换
const view = ref('map')
const touring = ref(true)
const compact = ref(false)
let tourTimer = null

// 城市与漫游状态
const roamBarCities = ref([...FEATURED_CITIES])
const currentCity = ref(FEATURED_CITIES[0])
const citySnapshots = ref({})
const lunarText = ref('')
const locating = ref(false)
const toastMessage = ref('')

// 气象状态
const weatherData = ref(null)
const weatherCityId = ref(null)
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

// 环境声
const soundscape = new WeatherSoundscape()
const ambientRunning = ref(false)
const ambientMix = ref({ rain: 0, wind: 20, hearth: 0, chimes: 25 })

// 收藏簿
const favoritesOpen = ref(false)
const favorites = ref(loadFavoritesFromStorage())
const favoriteIds = computed(() => new Set(favorites.value.map((f) => f.id)))

const viewComponent = computed(() => ({ map: ViewMap, station: ViewStation, trace: ViewTrace })[view.value])

const chartDate = computed(() => {
  const d = new Date()
  const w = '日一二三四五六'[d.getDay()]
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 周${w} ${String(d.getHours()).padStart(2, '0')}时`
})

// 当前生效的天气（实况，或用户在七日预报中点选的那一天）
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

const basis = computed(() => {
  if (customQueryActive.value) return `点歌 · ${customAppliedTerm.value}`
  const ew = effectiveWeather.value
  const meta = getWeatherMeta(ew.code, ew.isDay, ew.temp)
  if (selectedDayIndex.value != null && weatherData.value?.daily7?.[selectedDayIndex.value]) {
    return `按${weatherData.value.daily7[selectedDayIndex.value].dayLabel}预报 · ${meta.short}`
  }
  if (!weatherData.value) return ''
  return `按实况 · ${meta.short} ${Math.round(ew.temp)}°`
})

const stations = computed(() =>
  roamBarCities.value.map((c) => ({ city: c, snap: citySnapshots.value[c.id] || null }))
)

const viewProps = computed(() => ({
  city: currentCity.value,
  // 只把属于当前城市的数据交给图面，切换城市时先显示「观测中」，不残留上一座城的读数
  weather: weatherCityId.value === currentCity.value.id ? weatherData.value : null,
  loading: weatherLoading.value,
  error: weatherError.value,
  stations: stations.value,
  tracks: tracks.value,
  musicLoading: musicLoading.value,
  musicError: musicError.value,
  basis: basis.value,
  favoriteIds: favoriteIds.value,
  fallbackNotice: musicFallbackNotice.value,
  compact: compact.value
}))

/* ---------- 自动轮换 ---------- */
function scheduleTour() {
  if (tourTimer) clearTimeout(tourTimer)
  tourTimer = null
  if (!touring.value) return
  tourTimer = setTimeout(() => {
    if (!touring.value) return
    if (document.hidden || favoritesOpen.value) {
      scheduleTour()
      return
    }
    const i = VIEW_ORDER.indexOf(view.value)
    view.value = VIEW_ORDER[(i + 1) % VIEW_ORDER.length]
  }, TOUR_MS)
}

function stopTour() {
  touring.value = false
  if (tourTimer) clearTimeout(tourTimer)
  tourTimer = null
}

function toggleTour() {
  touring.value = !touring.value
  scheduleTour()
}

function handleSetView(id) {
  stopTour()
  view.value = id
}

// 访客一旦动手操作（点击或按键），就停下轮换，把图面交给他
function onUserIntent(e) {
  if (!touring.value) return
  if (e.target?.closest?.('.tour-btn')) return
  stopTour()
}

watch(view, scheduleTour)

/* ---------- 数据 ---------- */
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
    // 无痕模式下忽略
  }
}

function showToast(msg) {
  toastMessage.value = msg
  setTimeout(() => {
    if (toastMessage.value === msg) toastMessage.value = ''
  }, 5000)
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
    weatherCityId.value = currentCity.value.id
    citySnapshots.value = {
      ...citySnapshots.value,
      [currentCity.value.id]: {
        temp: Math.round(data.current.temp),
        code: data.current.code,
        isDay: data.current.isDay,
        windSpeed: data.current.windSpeed,
        windDirection: data.current.windDirection,
        cloudCover: data.current.cloudCover
      }
    }
    syncAmbientToWeather()
    await loadMusicOnly(seq)
  } catch (err) {
    if (seq !== requestSeq) return
    weatherError.value = err?.message || '测站暂无回报，检查网络后点「重新观测」'
  } finally {
    if (seq === requestSeq) weatherLoading.value = false
  }
}

async function loadMusicOnly(parentSeq = requestSeq) {
  if (typeof parentSeq !== 'number') parentSeq = requestSeq
  clearTimeout(recoveryTimer)
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
      const queries = customQueryActive.value ? [customAppliedTerm.value] : musicProfile.value.queries
      list = await fetchWeatherMusic(queries, 7, {
        allowInstrumental: genreMode.value === 'pure' || customQueryActive.value
      })
    }
    if (parentSeq !== requestSeq) return
    tracks.value = list
  } catch (err) {
    if (parentSeq !== requestSeq) return
    // 在线曲库都连不上时，自动降级到国内 FM 音乐台 MP3 直播
    if (genreMode.value !== 'cnradio') {
      try {
        const ew = effectiveWeather.value
        const meta = getWeatherMeta(ew.code, ew.isDay, ew.temp)
        const list = await fetchDomesticMusicStations(meta.category, ew.isDay)
        if (parentSeq !== requestSeq) return
        if (list.length) {
          tracks.value = list
          musicFallbackNotice.value = `${err?.message || '在线曲库暂时连不上'}，先改播国内 FM 音乐台直播；稍后会自动再找歌，也可以点「重新检索歌曲」。`
          scheduleMusicRecovery(parentSeq)
          return
        }
      } catch {
        // 两条路都失败时展示错误
      }
    }
    if (parentSeq !== requestSeq) return
    musicError.value = err?.message || '歌曲检索失败。'
  } finally {
    if (parentSeq === requestSeq) musicLoading.value = false
  }
}

watch(tracks, (list) => player.setQueue(list))

// 退回电台后 45 秒自动再检索一次歌曲；找到就换回歌曲（限流一般一分钟内解除）
let recoveryTimer = null
function scheduleMusicRecovery(seq) {
  clearTimeout(recoveryTimer)
  recoveryTimer = setTimeout(async () => {
    if (seq !== requestSeq || genreMode.value === 'cnradio' || !musicFallbackNotice.value) return
    try {
      const queries = customQueryActive.value ? [customAppliedTerm.value] : musicProfile.value.queries
      const list = await fetchWeatherMusic(queries, 7, {
        allowInstrumental: genreMode.value === 'pure' || customQueryActive.value
      })
      if (seq !== requestSeq || !list.length || !musicFallbackNotice.value) return
      tracks.value = list
      musicFallbackNotice.value = ''
    } catch {
      /* 仍然连不上，保持电台 */
    }
  }, 45000)
}

function syncAmbientToWeather() {
  ambientMix.value = { ...musicProfile.value.ambientPreset }
  soundscape.setMix(ambientMix.value)
}

function handleSelectCity(city) {
  if (!roamBarCities.value.some((c) => c.id === city.id)) {
    roamBarCities.value = [...roamBarCities.value.slice(0, 11), city]
  }
  if (city.id === currentCity.value.id && weatherData.value) return
  currentCity.value = city
  customQueryActive.value = false
  batchIndex.value = 0
  loadCityWeatherAndMusic()
}

function handleRandomRoam() {
  const pool = ROAM_CITY_POOL.filter((c) => c.id !== currentCity.value.id)
  const pick = pool[Math.floor(Math.random() * pool.length)]
  if (pick) {
    handleSelectCity(pick)
    showToast(`随机到了 ${pick.name}（${pick.region}）。`)
  }
}

function handleLocateMe() {
  if (!navigator.geolocation) {
    showToast('这个浏览器不支持定位，直接在搜索框输入城市名即可。')
    return
  }
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locating.value = false
      handleSelectCity({
        id: 'my-location',
        name: '我的位置',
        region: '实时定位',
        vibe: '身边此刻',
        lat: pos.coords.latitude,
        lon: pos.coords.longitude
      })
    },
    () => {
      locating.value = false
      showToast('没有拿到定位权限，可以在搜索框直接输入城市名。')
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
  if (!customQueryActive.value) batchIndex.value += 1
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

function handleUpdateAmbientMix(mix) {
  ambientMix.value = mix
  soundscape.setMix(mix)
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
  favoritesOpen.value = false
  player.start(fav)
}

function measure() {
  compact.value = window.innerWidth < 900
}

watch(currentCity, (c) => {
  document.title = `${c.name} · 听见天气`
})

onMounted(() => {
  measure()
  // ?view=map|station|trace 可直接打开指定图式（同时关闭自动轮换）
  const qv = new URLSearchParams(location.search).get('view')
  if (VIEW_ORDER.includes(qv)) {
    view.value = qv
    touring.value = false
  }
  window.addEventListener('resize', measure)
  window.addEventListener('pointerdown', onUserIntent, true)
  window.addEventListener('keydown', onUserIntent, true)
  scheduleTour()

  loadCityWeatherAndMusic()
  fetchBatchCityWeather(FEATURED_CITIES)
    .then((snaps) => {
      const keep = citySnapshots.value[currentCity.value.id]
      citySnapshots.value = { ...citySnapshots.value, ...snaps, ...(keep ? { [currentCity.value.id]: keep } : {}) }
    })
    .catch(() => {})
  fetchLunarDate()
    .then((lunar) => {
      lunarText.value = lunar
    })
    .catch(() => {})
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', measure)
  window.removeEventListener('pointerdown', onUserIntent, true)
  window.removeEventListener('keydown', onUserIntent, true)
  if (tourTimer) clearTimeout(tourTimer)
  soundscape.dispose()
  player.dispose()
})
</script>

<style scoped>
.app {
  min-height: 100vh;
}

.skip {
  position: absolute;
  left: 12px;
  top: -60px;
  z-index: 60;
  padding: 6px 12px;
  background: var(--ink);
  color: var(--paper);
  text-decoration: none;
}

.skip:focus {
  top: 10px;
}

.sheet-wrap {
  padding: 10px var(--gutter) 0;
}

.sheet-title {
  margin: 0 0 6px;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 18px;
  font-size: 0.8125rem;
  color: var(--ink-2);
}

.sheet-title > span:first-child {
  font-weight: 700;
  color: var(--ink);
  letter-spacing: 0.1em;
}

.sheet-src {
  margin-left: auto;
  color: var(--ink-3);
}

.sheet-toast {
  margin: 0 0 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 6px 6px 12px;
  border: 1px solid var(--rule);
  background: var(--paper-lift);
  font-size: 0.875rem;
}

.sheet {
  position: relative;
  height: max(600px, calc(100vh - var(--masthead-h) - 46px));
  max-height: 940px;
  border: 1px solid var(--rule);
  outline: 4px double transparent;
  box-shadow:
    0 0 0 3px var(--paper),
    0 0 0 4px var(--rule-soft);
  overflow: hidden;
}

.sheet.compact {
  height: auto;
  max-height: none;
  overflow: visible;
}

/* 图式切换：新图面像记录笔一样从左向右展开 */
.sheet-view-enter-active {
  transition:
    clip-path var(--dur-view) var(--ease-out),
    opacity 200ms ease;
}

.sheet-view-leave-active {
  transition: opacity 160ms ease;
}

.sheet-view-enter-from {
  clip-path: inset(0 100% 0 0);
  opacity: 0.6;
}

.sheet-view-enter-to {
  clip-path: inset(0 0 0 0);
}

.sheet-view-leave-to {
  opacity: 0;
}

.below {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  gap: 48px;
  padding: 40px var(--gutter) 8px;
}

.colophon {
  margin: 32px var(--gutter) 0;
  padding: 14px 0 28px;
  border-top: 1px solid var(--rule);
  font-size: 0.8125rem;
  color: var(--ink-3);
  max-width: 80ch;
}

.colophon p {
  margin: 0 0 4px;
}

@media (max-width: 1100px) {
  .below {
    grid-template-columns: minmax(0, 1fr);
    gap: 32px;
  }
}

@media (max-width: 900px) {
  .sheet-src {
    margin-left: 0;
  }
  .sheet-wrap {
    padding: 10px 10px 0;
  }
  .below {
    padding: 28px 14px 8px;
  }
  .colophon {
    margin: 24px 14px 0;
  }
}
</style>
