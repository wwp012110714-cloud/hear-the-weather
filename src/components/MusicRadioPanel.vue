<template>
  <section class="music-panel glass-panel" aria-label="气象智能推歌黑胶电台">
    <!-- 顶部智能气象声景推导卡片 -->
    <div class="profile-banner">
      <div class="profile-top">
        <div class="badge-group">
          <span class="mood-badge">{{ customQueryActive ? '自由点歌频道' : profile.moodBadge }}</span>
          <span
            v-for="q in (customQueryActive ? [customAppliedTerm] : profile.queries.slice(0, 3))"
            :key="q"
            class="query-chip"
          >
            # {{ q }}
          </span>
        </div>

        <button
          type="button"
          class="shuffle-btn"
          :disabled="loading"
          @click="$emit('next-batch')"
        >
          <svg :class="{ spinning: loading }" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M20 11A8 8 0 1 0 21.4 15.5M20 4V11H13"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span>换一批好歌</span>
        </button>
      </div>

      <h2 class="channel-heading">
        {{ customQueryActive ? `「${customAppliedTerm}」点歌电台` : `「${profile.moodTitle}」` }}
      </h2>
      <p class="reason-line">
        {{
          customQueryActive
            ? `正在当前城市天象背景下播放「${customAppliedTerm}」人声曲目，可随时切回智能天气推歌`
            : profile.reasonText
        }}
      </p>

      <!-- 曲风切换胶囊 + 电台自由点歌栏 -->
      <div class="filter-bar">
        <div class="genre-pills">
          <button
            v-for="g in GENRE_MODES"
            :key="g.id"
            type="button"
            class="genre-pill"
            :class="{ active: !customQueryActive && genreMode === g.id }"
            @click="selectGenre(g.id)"
          >
            {{ g.label }}
          </button>
        </div>

        <form class="song-search-form" @submit.prevent="submitCustomSong">
          <input
            v-model="songInput"
            type="text"
            class="song-input"
            placeholder="搜歌手或网络热歌（如：周杰伦、告五人）"
          />
          <button v-if="customQueryActive" type="button" class="back-smart-btn" @click="resetToSmart">
            恢复智能推歌
          </button>
          <button v-else type="submit" class="song-go-btn">搜歌</button>
        </form>
      </div>
    </div>

    <!-- 中部拟物黑胶唱机与播放控制台 -->
    <div class="turntable-stage" :class="{ 'is-playing': isPlaying }">
      <!-- 专辑封面模糊氛围光（Album art colors） -->
      <div
        class="stage-backdrop"
        aria-hidden="true"
        :style="currentTrack?.coverLg ? { backgroundImage: `url(${currentTrack.coverLg})` } : null"
      ></div>
      <div class="vinyl-box">
        <div class="vinyl-disc" :class="{ spinning: isPlaying }">
          <div class="vinyl-grooves"></div>
          <img
            v-if="currentTrack?.coverLg"
            :src="currentTrack.coverLg"
            :alt="currentTrack.title"
            class="vinyl-cover"
          />
          <div v-else class="vinyl-cover placeholder-cover">听见天气</div>
          <div class="vinyl-spindle"></div>
        </div>
        <div class="tonearm" :class="{ engaged: isPlaying }">
          <div class="tonearm-pivot"></div>
          <div class="tonearm-rod"></div>
          <div class="tonearm-head"></div>
        </div>
      </div>

      <div class="player-controls-box">
        <template v-if="currentTrack">
          <div class="now-playing-tag-row">
            <div class="eq-bars" :class="{ active: isPlaying }" aria-hidden="true">
              <span></span><span></span><span></span><span></span>
            </div>
            <span class="playing-status-text">
              <template v-if="buffering">正在缓冲音频流…</template>
              <template v-else-if="isPlaying && currentTrack.isLiveStream">
                正在直播 · 国内 FM 纯 MP3 全长连播
              </template>
              <template v-else-if="isPlaying">
                正在播放 · 人声高潮试听（播完自动连播下一首）
              </template>
              <template v-else>
                已就绪 · 点击下方播放键或列表曲目即可播放
              </template>
            </span>
          </div>

          <h3 class="track-title" :title="currentTrack.title">{{ currentTrack.title }}</h3>
          <p class="track-meta">
            <span>{{ currentTrack.artist }}</span>
            <span class="dot">·</span>
            <span>{{ currentTrack.album }}</span>
            <template v-if="currentTrack.releaseYear">
              <span class="dot">·</span>
              <span class="tabular-nums">{{ currentTrack.releaseYear }}</span>
            </template>
          </p>

          <!-- 播放异常自愈提示 -->
          <div v-if="playbackNotice" class="playback-notice">
            <span>{{ playbackNotice }}</span>
            <button
              v-if="genreMode !== 'cnradio'"
              type="button"
              class="switch-mp3-btn"
              @click="selectGenre('cnradio')"
            >
              切至国内FM纯MP3直播
            </button>
          </div>

          <!-- 进度条 / 实况直播条 -->
          <div v-if="currentTrack.isLiveStream" class="live-stream-bar">
            <span class="live-pill">LIVE 实况</span>
            <div class="live-wave-track">
              <div class="live-wave-fill" :class="{ moving: isPlaying }"></div>
            </div>
            <span class="time-text tabular-nums">{{ formatSec(currentTime) }}</span>
          </div>
          <div v-else class="progress-area">
            <span class="time-text tabular-nums">{{ formatSec(currentTime) }}</span>
            <input
              type="range"
              min="0"
              :max="duration || 30"
              step="0.1"
              :value="currentTime"
              class="seek-slider"
              @input="onSeek($event.target.value)"
            />
            <span class="time-text tabular-nums">{{ formatSec(duration || 30) }}</span>
          </div>

          <!-- 播放主控按钮行 -->
          <div class="transport-row">
            <div class="transport-main">
              <button type="button" class="ctrl-btn" title="上一首" aria-label="上一首" @click="playPrev">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z" />
                </svg>
              </button>

              <button
                type="button"
                class="play-main-btn"
                :disabled="buffering"
                :title="isPlaying ? '暂停' : '播放'"
                :aria-label="isPlaying ? '暂停' : '播放'"
                @click="togglePlay"
              >
                <svg v-if="!isPlaying" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5.14v13.72L19 12 8 5.14z" />
                </svg>
                <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
                </svg>
              </button>

              <button type="button" class="ctrl-btn" title="下一首" aria-label="下一首" @click="playNext">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 6h2v12h-2V6zM6 18l8.5-6L6 6v12z" />
                </svg>
              </button>

              <button
                type="button"
                class="fav-track-btn"
                :class="{ liked: isCurrentFavorite }"
                title="将这首歌与当前城市天气一起收藏"
                @click="$emit('toggle-favorite', currentTrack)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" :fill="isCurrentFavorite ? '#FB7185' : 'none'">
                  <path
                    d="M12 20.5C12 20.5 4 15.2 4 9.2C4 6.5 6.1 4.5 8.7 4.5C10.3 4.5 11.7 5.3 12 6.5C12.3 5.3 13.7 4.5 15.3 4.5C17.9 4.5 20 6.5 20 9.2C20 15.2 12 20.5 12 20.5Z"
                    :stroke="isCurrentFavorite ? '#FB7185' : 'currentColor'"
                    stroke-width="2"
                    stroke-linejoin="round"
                  />
                </svg>
                <span>{{ isCurrentFavorite ? '已封存此刻' : '封存晴雨' }}</span>
              </button>
            </div>

            <!-- 音乐音量 -->
            <div class="vol-box" title="调节音乐音量">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path
                  d="M11 5L6 9H2V15H6L11 19V5ZM15.5 8.5C16.8 9.8 16.8 14.2 15.5 15.5M18.5 5.5C21.5 8.5 21.5 15.5 18.5 18.5"
                  stroke="currentColor"
                  stroke-width="1.9"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <input
                v-model.number="volume"
                aria-label="音乐音量"
                type="range"
                min="0"
                max="1"
                step="0.02"
                class="vol-slider"
              />
            </div>
          </div>
        </template>

        <div v-else class="empty-deck">
          正在根据当地实时气象为你挑选人声歌曲…
        </div>
      </div>

      <!-- 原生音频播放器 -->
      <audio
        ref="audioRef"
        preload="none"
        @timeupdate="handleTimeUpdate"
        @loadedmetadata="handleLoadedMetadata"
        @ended="handleEnded"
      ></audio>
    </div>

    <!-- 自然环境白噪音混音器 -->
    <AmbientMixer
      :running="ambientRunning"
      :mix="ambientMix"
      @toggle-running="$emit('toggle-ambient')"
      @update-mix="$emit('update-ambient-mix', $event)"
      @reset-preset="$emit('reset-ambient-preset')"
    />

    <!-- 实时推荐歌单列表 -->
    <div class="playlist-section">
      <div class="playlist-header">
        <span class="playlist-title">
          {{ genreMode === 'cnradio' ? `国内音乐广播台（共 ${tracks.length} 个）` : `智能匹配人声歌单（共 ${tracks.length} 首）` }}
        </span>
        <span class="playlist-tip">
          {{ genreMode === 'cnradio' ? '点击任意电台即可全长不间断收听' : '点击任意歌曲立即播放 · 自动连播' }}
        </span>
      </div>

      <div v-if="fallbackNotice" class="playback-notice">
        <span>{{ fallbackNotice }}</span>
        <button type="button" class="switch-mp3-btn" @click="$emit('retry')">重新尝试歌曲库</button>
      </div>

      <!-- 加载中骨架屏 -->
      <div v-if="loading && tracks.length === 0" class="playlist-skeleton">
        <div v-for="n in 5" :key="n" class="skeleton-block" style="height: 54px"></div>
      </div>

      <!-- 错误提示与重试 -->
      <div v-else-if="error && tracks.length === 0" class="playlist-error">
        <p>{{ error }}</p>
        <div class="err-btn-group">
          <button type="button" class="retry-btn" @click="$emit('retry')">重试当前接口</button>
          <button
            v-if="genreMode !== 'cnradio'"
            type="button"
            class="retry-btn"
            @click="selectGenre('cnradio')"
          >
            切换至国内FM音乐台
          </button>
        </div>
      </div>

      <!-- 空结果提示 -->
      <div v-else-if="!loading && tracks.length === 0" class="playlist-error">
        <p>暂未检索到对应歌曲，可尝试切换频道或换一批</p>
        <button type="button" class="retry-btn" @click="resetToSmart">恢复默认天气推歌</button>
      </div>

      <!-- 曲目渲染列表 -->
      <ul v-else class="track-list" :class="{ dimmed: loading }">
        <li
          v-for="(item, index) in tracks"
          :key="item.id"
          class="track-row"
          :class="{ active: currentTrack?.id === item.id }"
          tabindex="0"
          role="button"
          :aria-current="currentTrack?.id === item.id ? 'true' : undefined"
          @click="selectTrack(item, true)"
          @keydown.enter.prevent="selectTrack(item, true)"
          @keydown.space.prevent="selectTrack(item, true)"
        >
          <span class="track-idx tabular-nums">
            <template v-if="currentTrack?.id === item.id && isPlaying">▶</template>
            <template v-else>{{ String(index + 1).padStart(2, '0') }}</template>
          </span>

          <img :src="item.coverSm" :alt="`${item.title} 封面`" class="row-cover" loading="lazy" width="44" height="44" />

          <div class="row-info">
            <div class="row-title">{{ item.title }}</div>
            <div class="row-sub">{{ item.artist }} · {{ item.album }}</div>
          </div>

          <span class="row-genre">{{ item.genre }}</span>

          <button
            type="button"
            class="row-fav-btn"
            :title="favoriteIds.has(item.id) ? '取消收藏' : '收藏此刻晴雨'"
            :aria-label="favoriteIds.has(item.id) ? '取消收藏' : '收藏此刻晴雨'"
            @click.stop="$emit('toggle-favorite', item)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" :fill="favoriteIds.has(item.id) ? '#FB7185' : 'none'">
              <path
                d="M12 20.5C12 20.5 4 15.2 4 9.2C4 6.5 6.1 4.5 8.7 4.5C10.3 4.5 11.7 5.3 12 6.5C12.3 5.3 13.7 4.5 15.3 4.5C17.9 4.5 20 6.5 20 9.2C20 15.2 12 20.5 12 20.5Z"
                :stroke="favoriteIds.has(item.id) ? '#FB7185' : 'currentColor'"
                stroke-width="1.9"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import AmbientMixer from './AmbientMixer.vue'
import { GENRE_MODES } from '../utils/weatherMap'

const props = defineProps({
  profile: {
    type: Object,
    required: true
  },
  tracks: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ''
  },
  genreMode: {
    type: String,
    default: 'auto'
  },
  customQueryActive: {
    type: Boolean,
    default: false
  },
  customAppliedTerm: {
    type: String,
    default: ''
  },
  favoriteIds: {
    type: Object,
    required: true
  },
  externalTrack: {
    type: Object,
    default: null
  },
  ambientRunning: {
    type: Boolean,
    default: false
  },
  ambientMix: {
    type: Object,
    required: true
  },
  fallbackNotice: {
    type: String,
    default: ''
  }
})

const emit = defineEmits([
  'change-genre',
  'custom-search',
  'reset-custom',
  'next-batch',
  'retry',
  'toggle-favorite',
  'toggle-ambient',
  'update-ambient-mix',
  'reset-ambient-preset'
])

const audioRef = ref(null)
const currentTrack = ref(null)
const isPlaying = ref(false)
const buffering = ref(false)
const playbackNotice = ref('')
const currentTime = ref(0)
const duration = ref(30)
const volume = ref(0.85)
const songInput = ref('')

// Blob URL 缓存与 Web Audio 备用解码播放句柄（彻底修复 Apple CDN 返回 audio/x-m4p 导致部分浏览器拒播的问题）
let activeObjectUrl = null
let fallbackCtx = null
let fallbackSource = null
let fallbackGain = null
let fallbackStartOffset = 0
let fallbackStartedAt = 0
let fallbackTimer = null
let playToken = 0

const isCurrentFavorite = computed(() =>
  currentTrack.value ? props.favoriteIds.has(currentTrack.value.id) : false
)

function cleanupAudioResources() {
  if (fallbackTimer) {
    clearInterval(fallbackTimer)
    fallbackTimer = null
  }
  if (fallbackSource) {
    try {
      fallbackSource.onended = null
      fallbackSource.stop()
      fallbackSource.disconnect()
    } catch {
      // ignore
    }
    fallbackSource = null
  }
  if (audioRef.value) {
    audioRef.value.pause()
  }
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl)
    activeObjectUrl = null
  }
}

watch(
  () => props.tracks,
  async (newList) => {
    if (!newList || newList.length === 0) return
    const shouldKeepPlaying = isPlaying.value
    currentTrack.value = newList[0]
    playbackNotice.value = ''
    if (shouldKeepPlaying) {
      await startTrackPlayback(newList[0])
    } else {
      cleanupAudioResources()
      currentTime.value = 0
      duration.value = 30
      isPlaying.value = false
    }
  },
  { immediate: true }
)

watch(
  () => props.externalTrack,
  async (ext) => {
    if (!ext) return
    currentTrack.value = ext
    await startTrackPlayback(ext)
  }
)

watch(volume, (v) => {
  if (audioRef.value) {
    audioRef.value.volume = v
  }
  if (fallbackGain && fallbackCtx) {
    fallbackGain.gain.setValueAtTime(v, fallbackCtx.currentTime)
  }
})

/**
 * 兼容性强化音频播放核心：
 * 1. 针对国内 FM 直播 MP3 流：直接通过原生 <audio> 播放 audio/mpeg
 * 2. 针对 iTunes 歌曲试听流：先以 CORS 拉取二进制并将 MIME 修正为标准 audio/mp4（解决 Firefox/部分 Chromium 拦截 audio/x-m4p 的问题），
 *    若 <audio> 仍无法解码，再自动降级使用 Web Audio decodeAudioData 播放！
 */
async function startTrackPlayback(track) {
  if (!track?.previewUrl) return
  const token = ++playToken
  cleanupAudioResources()
  await nextTick()

  const el = audioRef.value
  if (!el) return

  buffering.value = true
  playbackNotice.value = ''
  currentTime.value = 0

  try {
    // 路径 A：国内 FM 音乐台实况 MP3 流 / Deezer 标准 MP3 试听流 —— 原生直接播放
    if (track.isLiveStream || track.directPlay) {
      el.src = track.previewUrl
      el.volume = volume.value
      await el.play()
      if (token !== playToken) return
      isPlaying.value = true
      buffering.value = false
      return
    }

    // 路径 B：拉取歌曲音频字节并重写 MIME 为标准 audio/mp4
    let arrayBuf = null
    try {
      const ctrl = new AbortController()
      const abortTimer = setTimeout(() => ctrl.abort(), 9000)
      try {
        const resp = await fetch(track.previewUrl, { signal: ctrl.signal })
        if (resp.ok) {
          arrayBuf = await resp.arrayBuffer()
        }
      } finally {
        clearTimeout(abortTimer)
      }
    } catch {
      arrayBuf = null
    }

    if (token !== playToken) return

    if (arrayBuf && arrayBuf.byteLength > 512) {
      const mp4Blob = new Blob([arrayBuf], { type: 'audio/mp4' })
      activeObjectUrl = URL.createObjectURL(mp4Blob)
      el.src = activeObjectUrl
    } else {
      el.src = track.previewUrl
    }

    el.volume = volume.value

    try {
      await el.play()
      if (token !== playToken) return
      isPlaying.value = true
      buffering.value = false
      return
    } catch (err) {
      // 路径 C：若 <audio> 标签不支持当前容器解码，使用 Web Audio API 直接软解播放
      if (arrayBuf) {
        const playedViaWebAudio = await playBufferViaWebAudio(arrayBuf, token)
        if (playedViaWebAudio) {
          buffering.value = false
          return
        }
      }
      throw err
    }
  } catch {
    if (token !== playToken) return
    isPlaying.value = false
    buffering.value = false
    playbackNotice.value = '当前浏览器或网络环境拦截了该 AAC 音频解码，可点击右侧按钮一键切换纯 MP3 国内音乐广播'
  }
}

async function playBufferViaWebAudio(arrayBuf, token) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return false
    if (!fallbackCtx) fallbackCtx = new AudioCtx()
    if (fallbackCtx.state === 'suspended') await fallbackCtx.resume()

    const decoded = await fallbackCtx.decodeAudioData(arrayBuf.slice(0))
    if (token !== playToken) return false

    fallbackGain = fallbackCtx.createGain()
    fallbackGain.gain.value = volume.value
    fallbackGain.connect(fallbackCtx.destination)

    const src = fallbackCtx.createBufferSource()
    src.buffer = decoded
    src.connect(fallbackGain)

    duration.value = decoded.duration || 30
    fallbackStartOffset = 0
    fallbackStartedAt = fallbackCtx.currentTime
    fallbackSource = src
    isPlaying.value = true

    fallbackTimer = setInterval(() => {
      if (fallbackCtx && isPlaying.value) {
        currentTime.value = Math.min(
          duration.value,
          fallbackStartOffset + (fallbackCtx.currentTime - fallbackStartedAt)
        )
      }
    }, 200)

    src.onended = () => {
      if (token === playToken && isPlaying.value) {
        playNext()
      }
    }

    src.start(0)
    return true
  } catch {
    return false
  }
}

async function selectTrack(track, autoPlay = true) {
  if (currentTrack.value?.id === track.id) {
    await togglePlay()
    return
  }
  currentTrack.value = track
  if (autoPlay) {
    await startTrackPlayback(track)
  }
}

async function togglePlay() {
  if (!currentTrack.value) return

  // 若正在通过 Web Audio 备用通道播放
  if (fallbackSource) {
    cleanupAudioResources()
    isPlaying.value = false
    return
  }

  const el = audioRef.value
  if (!el) return

  if (isPlaying.value && !el.paused) {
    el.pause()
    isPlaying.value = false
  } else if (el.src && el.currentTime > 0 && !currentTrack.value.isLiveStream) {
    try {
      await el.play()
      isPlaying.value = true
    } catch {
      await startTrackPlayback(currentTrack.value)
    }
  } else {
    await startTrackPlayback(currentTrack.value)
  }
}

function playNext() {
  if (!props.tracks.length) return
  const idx = props.tracks.findIndex((t) => t.id === currentTrack.value?.id)
  const nextIdx = idx >= 0 ? (idx + 1) % props.tracks.length : 0
  selectTrack(props.tracks[nextIdx], true)
}

function playPrev() {
  if (!props.tracks.length) return
  const idx = props.tracks.findIndex((t) => t.id === currentTrack.value?.id)
  const prevIdx = idx > 0 ? idx - 1 : props.tracks.length - 1
  selectTrack(props.tracks[prevIdx], true)
}

function handleTimeUpdate() {
  if (audioRef.value && !fallbackSource) {
    currentTime.value = audioRef.value.currentTime || 0
  }
}

function handleLoadedMetadata() {
  if (audioRef.value && Number.isFinite(audioRef.value.duration) && audioRef.value.duration > 0) {
    duration.value = audioRef.value.duration
  }
}

function handleEnded() {
  if (!currentTrack.value?.isLiveStream) {
    playNext()
  }
}

function onSeek(val) {
  const num = Number(val)
  currentTime.value = num
  if (audioRef.value && !fallbackSource) {
    audioRef.value.currentTime = num
  }
}

function selectGenre(id) {
  songInput.value = ''
  playbackNotice.value = ''
  emit('change-genre', id)
}

function submitCustomSong() {
  const q = songInput.value.trim()
  if (!q) return
  playbackNotice.value = ''
  emit('custom-search', q)
}

function resetToSmart() {
  songInput.value = ''
  playbackNotice.value = ''
  emit('reset-custom')
}

function formatSec(sec) {
  const s = Math.max(0, Math.floor(sec || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

onBeforeUnmount(() => {
  cleanupAudioResources()
  if (fallbackCtx) {
    fallbackCtx.close().catch(() => {})
    fallbackCtx = null
  }
})
</script>

<style scoped>
.music-panel {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.profile-banner {
  padding-bottom: 15px;
  border-bottom: 1px solid var(--border-subtle);
}

.profile-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.badge-group {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}

.mood-badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--accent);
  color: #0f172a;
}

.query-chip {
  font-size: 0.75rem;
  padding: 2px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
}

.shuffle-btn {
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.06);
  font-size: 0.78rem;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.shuffle-btn:hover:not(:disabled) {
  background: var(--surface-hover);
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.channel-heading {
  margin: 10px 0 4px;
  font-size: 1.38rem;
  font-weight: 700;
}

.reason-line {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.filter-bar {
  margin-top: 13px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.genre-pills {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.genre-pill {
  height: 30px;
  padding: 0 11px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.045);
  font-size: 0.76rem;
  color: var(--text-secondary);
  transition: all 0.18s;
}

.genre-pill:hover {
  background: rgba(255, 255, 255, 0.11);
}

.genre-pill.active {
  background: var(--accent-soft);
  border-color: var(--accent-border);
  color: var(--accent-text);
  font-weight: 600;
}

.song-search-form {
  display: flex;
  align-items: center;
  gap: 6px;
}

.song-input {
  height: 30px;
  width: 210px;
  padding: 0 11px;
  border-radius: 999px;
  border: 1px solid var(--border-subtle);
  background: rgba(8, 15, 28, 0.48);
  font-size: 0.76rem;
  outline: none;
}

.song-input:focus {
  border-color: var(--accent-border);
}

.song-go-btn,
.back-smart-btn {
  height: 30px;
  padding: 0 11px;
  border-radius: 999px;
  border: 1px solid var(--accent-border);
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 0.75rem;
  white-space: nowrap;
}

/* 黑胶唱机舞台 */
.turntable-stage {
  padding: 18px;
  border-radius: 20px;
  background: linear-gradient(145deg, rgba(9, 16, 29, 0.62), rgba(15, 26, 45, 0.42));
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: grid;
  grid-template-columns: 186px 1fr;
  gap: 22px;
  align-items: center;
}

.vinyl-box {
  position: relative;
  width: 176px;
  height: 168px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.vinyl-disc {
  position: relative;
  width: 158px;
  height: 158px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    #1e293b 0%,
    #090d16 34%,
    #18212f 36%,
    #070b12 58%,
    #1c2536 60%,
    #06090f 100%
  );
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.55), inset 0 0 0 2px rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: recordSpin 14s linear infinite;
  animation-play-state: paused;
}

.vinyl-disc.spinning {
  animation-play-state: running;
}

@keyframes recordSpin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.vinyl-grooves {
  position: absolute;
  inset: 10px;
  border-radius: 50%;
  border: 1px dashed rgba(255, 255, 255, 0.07);
  pointer-events: none;
}

.vinyl-cover {
  width: 82px;
  height: 82px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid rgba(255, 255, 255, 0.18);
}

.placeholder-cover {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1e293b;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.vinyl-spindle {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #e2e8f0;
  border: 3px solid #0f172a;
}

.tonearm {
  position: absolute;
  top: 10px;
  right: 4px;
  width: 32px;
  height: 112px;
  transform-origin: 16px 14px;
  transform: rotate(-18deg);
  transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: none;
}

.tonearm.engaged {
  transform: rotate(12deg);
}

.tonearm-pivot {
  width: 24px;
  height: 24px;
  margin: 0 auto;
  border-radius: 50%;
  background: linear-gradient(135deg, #e2e8f0, #64748b);
  border: 3px solid #0f172a;
}

.tonearm-rod {
  width: 4px;
  height: 76px;
  margin: -2px auto 0;
  background: linear-gradient(90deg, #cbd5e1, #94a3b8);
  border-radius: 4px;
}

.tonearm-head {
  width: 12px;
  height: 16px;
  margin: -2px auto 0;
  border-radius: 3px;
  background: var(--accent);
}

.player-controls-box {
  min-width: 0;
}

.now-playing-tag-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.eq-bars {
  display: inline-flex;
  align-items: flex-end;
  gap: 2.5px;
  height: 13px;
}

.eq-bars span {
  width: 3px;
  height: 4px;
  border-radius: 2px;
  background: var(--accent);
}

.eq-bars.active span:nth-child(1) {
  animation: eqBounce 0.7s infinite ease-in-out;
}
.eq-bars.active span:nth-child(2) {
  animation: eqBounce 0.55s infinite ease-in-out 0.15s;
}
.eq-bars.active span:nth-child(3) {
  animation: eqBounce 0.8s infinite ease-in-out 0.25s;
}
.eq-bars.active span:nth-child(4) {
  animation: eqBounce 0.62s infinite ease-in-out 0.1s;
}

@keyframes eqBounce {
  0%,
  100% {
    height: 4px;
  }
  50% {
    height: 13px;
  }
}

.playing-status-text {
  font-size: 0.75rem;
  color: var(--accent-text);
}

.track-title {
  margin: 6px 0 4px;
  font-size: 1.25rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-meta {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dot {
  margin: 0 6px;
  color: var(--text-muted);
}

.playback-notice {
  margin-top: 8px;
  padding: 7px 11px;
  border-radius: 10px;
  background: rgba(245, 158, 11, 0.16);
  border: 1px solid rgba(245, 158, 11, 0.42);
  font-size: 0.75rem;
  color: #fde68a;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.switch-mp3-btn {
  padding: 3px 10px;
  border-radius: 999px;
  border: none;
  background: #fbbf24;
  color: #0f172a;
  font-size: 0.75rem;
  font-weight: 700;
}

.live-stream-bar,
.progress-area {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.live-pill {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(244, 63, 94, 0.22);
  border: 1px solid rgba(244, 63, 94, 0.5);
  color: #fda4af;
  font-size: 0.7rem;
  font-weight: 700;
  white-space: nowrap;
}

.live-wave-track {
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
}

.live-wave-fill {
  height: 100%;
  width: 100%;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  background-size: 200% 100%;
}

.live-wave-fill.moving {
  animation: shimmer 1.8s infinite linear;
}

.time-text {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.seek-slider {
  flex: 1;
  accent-color: var(--accent);
  cursor: pointer;
}

.transport-row {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.transport-main {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ctrl-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s;
}

.ctrl-btn:hover {
  background: rgba(255, 255, 255, 0.14);
}

.play-main-btn {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: none;
  background: var(--accent);
  color: #0f172a;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
  transition: transform 0.16s;
}

.play-main-btn:hover:not(:disabled) {
  transform: scale(1.05);
}

.play-main-btn:disabled {
  opacity: 0.65;
  cursor: wait;
}

.fav-track-btn {
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.05);
  font-size: 0.77rem;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.fav-track-btn.liked {
  border-color: rgba(251, 113, 133, 0.5);
  background: rgba(251, 113, 133, 0.14);
  color: #fecdd3;
}

.vol-box {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
}

.vol-slider {
  width: 78px;
  accent-color: var(--accent);
}

.empty-deck {
  font-size: 0.88rem;
  color: var(--text-secondary);
  padding: 20px 0;
}

.playlist-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.playlist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.playlist-title {
  font-size: 0.86rem;
  font-weight: 600;
}

.playlist-tip {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.playlist-skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.playlist-error {
  padding: 24px 16px;
  text-align: center;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  font-size: 0.84rem;
  color: var(--text-secondary);
}

.err-btn-group {
  display: flex;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}

.retry-btn {
  margin-top: 10px;
  padding: 7px 16px;
  border-radius: 999px;
  border: 1px solid var(--accent-border);
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 0.8rem;
}

.track-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
  padding-right: 4px;
}

.track-list.dimmed {
  opacity: 0.65;
}

.track-row {
  padding: 8px 11px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.035);
  display: grid;
  grid-template-columns: 24px 42px 1fr auto 32px;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: all 0.16s;
}

.track-row:hover {
  background: rgba(255, 255, 255, 0.09);
}

.track-row.active {
  background: var(--accent-soft);
  border-color: var(--accent-border);
}

.track-idx {
  font-size: 0.76rem;
  color: var(--text-muted);
  text-align: center;
}

.track-row.active .track-idx {
  color: var(--accent-text);
  font-weight: 700;
}

.row-cover {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  object-fit: cover;
}

.row-info {
  min-width: 0;
}

.row-title {
  font-size: 0.87rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-sub {
  font-size: 0.75rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.row-genre {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.07);
  color: var(--text-secondary);
  white-space: nowrap;
}

.row-fav-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.row-fav-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

@media (max-width: 720px) {
  .turntable-stage {
    grid-template-columns: 1fr;
    justify-items: center;
    text-align: center;
  }
  .player-controls-box {
    width: 100%;
  }
  .now-playing-tag-row,
  .transport-row {
    justify-content: center;
  }
  .row-genre {
    display: none;
  }
  .track-row {
    grid-template-columns: 22px 40px 1fr 30px;
  }
}
/* ===== UI/UX Pro Max 视觉精修（Dark OLED + Album-art glow） ===== */
.music-panel {
  padding: 24px;
  gap: 18px;
}

.channel-heading {
  font-size: clamp(1.35rem, 2.4vw, 1.65rem);
  font-weight: 800;
  letter-spacing: 0.02em;
  line-height: 1.3;
}

.reason-line {
  font-size: 0.875rem;
  line-height: 1.6;
}

.mood-badge {
  font-size: 0.78rem;
  padding: 4px 12px;
  box-shadow: var(--shadow-glow);
}

.shuffle-btn {
  height: 38px;
  padding: 0 14px;
  font-size: 0.84rem;
  transition: background var(--dur-fast) ease, border-color var(--dur-fast) ease,
    transform var(--dur-fast) ease;
}

.shuffle-btn:hover:not(:disabled) {
  border-color: var(--border-strong);
}

.shuffle-btn:active:not(:disabled) {
  transform: scale(0.97);
}

/* 频道胶囊 */
.genre-pill {
  height: 36px;
  padding: 0 14px;
  font-size: 0.82rem;
  transition: background var(--dur-fast) ease, border-color var(--dur-fast) ease,
    color var(--dur-fast) ease, transform var(--dur-fast) ease;
}

.genre-pill:hover:not(.active) {
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.genre-pill:active {
  transform: scale(0.96);
}

.genre-pill.active {
  background: var(--accent);
  border-color: transparent;
  color: var(--on-accent);
  font-weight: 700;
  box-shadow: var(--shadow-glow);
}

.song-input {
  height: 36px;
  width: 240px;
  font-size: 0.82rem;
  transition: border-color var(--dur-fast) ease, box-shadow var(--dur-fast) ease;
}

.song-input::placeholder {
  color: var(--text-muted);
}

.song-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.song-go-btn,
.back-smart-btn {
  height: 36px;
  padding: 0 16px;
  font-size: 0.82rem;
  font-weight: 600;
  transition: background var(--dur-fast) ease, color var(--dur-fast) ease;
}

.song-go-btn:hover,
.back-smart-btn:hover {
  background: var(--accent);
  color: var(--on-accent);
}

/* 黑胶舞台 */
.turntable-stage {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  padding: 22px;
  border-radius: var(--radius-lg);
  background: linear-gradient(150deg, rgba(15, 15, 35, 0.82), rgba(27, 27, 48, 0.6));
  border: 1px solid var(--border-subtle);
  box-shadow: var(--glass-highlight), inset 0 -40px 80px -40px rgba(2, 6, 23, 0.6);
}

.stage-backdrop {
  position: absolute;
  inset: -40px;
  z-index: -1;
  background-size: cover;
  background-position: center;
  filter: blur(48px) saturate(160%);
  opacity: 0.32;
  transform: scale(1.1);
  transition: opacity var(--dur-slow) ease, background-image var(--dur-slow) ease;
}

.turntable-stage.is-playing .stage-backdrop {
  opacity: 0.5;
}

.vinyl-disc {
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.06),
    inset 0 0 0 2px rgba(255, 255, 255, 0.06);
}

.turntable-stage.is-playing .vinyl-disc {
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.6), 0 0 48px -6px var(--accent-border),
    inset 0 0 0 2px rgba(255, 255, 255, 0.06);
}

/* 黑胶反光高光 */
.vinyl-grooves {
  background: conic-gradient(
    from 30deg,
    transparent 0deg,
    rgba(255, 255, 255, 0.07) 40deg,
    transparent 80deg,
    transparent 200deg,
    rgba(255, 255, 255, 0.05) 230deg,
    transparent 260deg
  );
}

.track-title {
  font-size: clamp(1.25rem, 2.2vw, 1.5rem);
  font-weight: 800;
}

.track-meta {
  font-size: 0.875rem;
}

.playing-status-text {
  font-size: 0.8rem;
  font-weight: 600;
}

.ctrl-btn {
  width: 42px;
  height: 42px;
  transition: background var(--dur-fast) ease, transform var(--dur-fast) ease;
}

.ctrl-btn:active {
  transform: scale(0.92);
}

.play-main-btn {
  width: 56px;
  height: 56px;
  background: linear-gradient(145deg, var(--accent), var(--accent-strong));
  color: var(--on-accent);
  box-shadow: var(--shadow-glow), inset 0 1px 0 rgba(255, 255, 255, 0.45);
  transition: transform var(--dur-base) var(--ease-back), box-shadow var(--dur-base) ease;
}

.play-main-btn:hover:not(:disabled) {
  transform: scale(1.07);
  box-shadow: 0 14px 36px -6px var(--accent-border), inset 0 1px 0 rgba(255, 255, 255, 0.45);
}

.play-main-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.fav-track-btn {
  height: 40px;
  padding: 0 14px;
  font-size: 0.82rem;
  transition: background var(--dur-fast) ease, border-color var(--dur-fast) ease;
}

.fav-track-btn:hover {
  background: var(--surface-hover);
}

.seek-slider,
.vol-slider {
  height: 20px;
}

.vol-slider {
  width: 92px;
}

/* 歌单 */
.playlist-title {
  font-size: 0.95rem;
  font-weight: 700;
}

.playlist-tip {
  font-size: 0.78rem;
}

.track-list {
  gap: 8px;
  max-height: 380px;
  padding: 2px 6px 2px 2px;
}

.track-row {
  min-height: 62px;
  padding: 9px 12px;
  border-radius: var(--radius-md);
  background: var(--surface-2);
  grid-template-columns: 26px 44px minmax(0, 1fr) auto 36px;
  gap: 12px;
  transition: background var(--dur-fast) ease, border-color var(--dur-fast) ease,
    transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base) ease;
}

.track-row:hover {
  background: var(--surface-3);
  border-color: var(--border-strong);
  transform: translateX(3px);
}

.track-row:active {
  transform: scale(0.99);
}

.track-row.active {
  background: linear-gradient(100deg, var(--accent-soft), rgba(255, 255, 255, 0.03) 85%);
  border-color: var(--accent-border);
  box-shadow: inset 3px 0 0 var(--accent), 0 10px 26px -14px var(--accent-border);
}

.row-cover {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-sm);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.35);
}

.row-title {
  font-size: 0.92rem;
  font-weight: 700;
}

.row-sub {
  font-size: 0.78rem;
}

.track-row.active .row-title {
  color: var(--accent-text);
}

.row-fav-btn {
  width: 36px;
  height: 36px;
  transition: background var(--dur-fast) ease, transform var(--dur-fast) ease;
}

.row-fav-btn:active {
  transform: scale(0.88);
}

.playback-notice {
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  line-height: 1.5;
}

.switch-mp3-btn {
  min-height: 30px;
  padding: 4px 12px;
  font-size: 0.78rem;
}

.retry-btn {
  min-height: 38px;
  font-size: 0.84rem;
  transition: background var(--dur-fast) ease, color var(--dur-fast) ease;
}

.retry-btn:hover {
  background: var(--accent);
  color: var(--on-accent);
}

@media (max-width: 720px) {
  .music-panel {
    padding: 18px 16px;
  }
  .song-search-form {
    width: 100%;
  }
  .song-input {
    flex: 1;
    width: auto;
    min-width: 0;
  }
  .track-row {
    grid-template-columns: 22px 44px minmax(0, 1fr) 36px;
    gap: 10px;
  }
}

@media (pointer: coarse) {
  .genre-pill,
  .song-input,
  .song-go-btn,
  .back-smart-btn,
  .ctrl-btn,
  .row-fav-btn,
  .fav-track-btn {
    min-height: 44px;
  }
  .ctrl-btn,
  .row-fav-btn {
    min-width: 44px;
  }
}
</style>

