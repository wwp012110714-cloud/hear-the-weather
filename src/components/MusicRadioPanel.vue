<template>
  <section class="music-panel glass-panel" aria-label="气象智能推歌黑胶电台">
    <!-- 顶部智能气象声景推导卡片 -->
    <div class="profile-banner">
      <div class="profile-top">
        <div class="badge-group">
          <span class="mood-badge">{{ customQueryActive ? '自由点歌频道' : profile.moodBadge }}</span>
          <span
            v-for="q in profile.queries"
            :key="q"
            class="query-chip"
          >
            # {{ customQueryActive ? customAppliedTerm : q }}
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
          <span>换一批曲目</span>
        </button>
      </div>

      <h2 class="channel-heading">
        {{ customQueryActive ? `「${customAppliedTerm}」搜索电台` : `「${profile.moodTitle}」` }}
      </h2>
      <p class="reason-line">
        {{
          customQueryActive
            ? `正在当前城市天象背景下播放「${customAppliedTerm}」相关曲目，可随时切回智能天气推歌`
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
            placeholder="搜歌手或曲名（如：周杰伦、房东的猫）"
          />
          <button v-if="customQueryActive" type="button" class="back-smart-btn" @click="resetToSmart">
            恢复智能推歌
          </button>
          <button v-else type="submit" class="song-go-btn">点歌</button>
        </form>
      </div>
    </div>

    <!-- 中部拟物黑胶唱机与播放控制台 -->
    <div class="turntable-stage">
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
        <!-- 拟物唱臂 -->
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
              {{ isPlaying ? '正在播放 · 正版精华试听' : '已就绪 · 点击播放键聆听天气' }}
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

          <!-- 进度条 -->
          <div class="progress-area">
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
              <button type="button" class="ctrl-btn" title="上一首" @click="playPrev">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z" />
                </svg>
              </button>

              <button
                type="button"
                class="play-main-btn"
                :title="isPlaying ? '暂停' : '播放'"
                @click="togglePlay"
              >
                <svg v-if="!isPlaying" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5.14v13.72L19 12 8 5.14z" />
                </svg>
                <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
                </svg>
              </button>

              <button type="button" class="ctrl-btn" title="下一首" @click="playNext">
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
          正在根据当地实时气象为你挑选唱片…
        </div>
      </div>

      <!-- 原生音频播放器 -->
      <audio
        ref="audioRef"
        preload="metadata"
        @timeupdate="handleTimeUpdate"
        @loadedmetadata="handleLoadedMetadata"
        @ended="handleEnded"
        @play="isPlaying = true"
        @pause="isPlaying = false"
        @error="handleAudioError"
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
        <span class="playlist-title">智能匹配曲单（共 {{ tracks.length }} 首）</span>
        <span class="playlist-tip">点击曲目即可切换黑胶试听 · 自动连播</span>
      </div>

      <!-- 加载中骨架屏 -->
      <div v-if="loading && tracks.length === 0" class="playlist-skeleton">
        <div v-for="n in 5" :key="n" class="skeleton-block" style="height: 54px"></div>
      </div>

      <!-- 错误提示与重试 -->
      <div v-else-if="error && tracks.length === 0" class="playlist-error">
        <p>{{ error }}</p>
        <button type="button" class="retry-btn" @click="$emit('retry')">重新获取推荐音乐</button>
      </div>

      <!-- 空结果提示 -->
      <div v-else-if="!loading && tracks.length === 0" class="playlist-error">
        <p>暂未检索到对应曲目，可尝试切换曲风或换一批</p>
        <button type="button" class="retry-btn" @click="resetToSmart">恢复默认天气推荐</button>
      </div>

      <!-- 曲目渲染列表 -->
      <ul v-else class="track-list" :class="{ dimmed: loading }">
        <li
          v-for="(item, index) in tracks"
          :key="item.id"
          class="track-row"
          :class="{ active: currentTrack?.id === item.id }"
          @click="selectTrack(item, true)"
        >
          <span class="track-idx tabular-nums">
            <template v-if="currentTrack?.id === item.id && isPlaying">▶</template>
            <template v-else>{{ String(index + 1).padStart(2, '0') }}</template>
          </span>

          <img :src="item.coverSm" :alt="item.title" class="row-cover" loading="lazy" />

          <div class="row-info">
            <div class="row-title">{{ item.title }}</div>
            <div class="row-sub">{{ item.artist }} · {{ item.album }}</div>
          </div>

          <span class="row-genre">{{ item.genre }}</span>

          <button
            type="button"
            class="row-fav-btn"
            :title="favoriteIds.has(item.id) ? '取消收藏' : '收藏此刻晴雨'"
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
import { ref, computed, watch, nextTick } from 'vue'
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
const currentTime = ref(0)
const duration = ref(30)
const volume = ref(0.82)
const songInput = ref('')

const isCurrentFavorite = computed(() =>
  currentTrack.value ? props.favoriteIds.has(currentTrack.value.id) : false
)

// 当城市或推荐歌单更新时：默认选中新城市首曲；若之前正在播放，无缝自动续播新城市氛围曲！
watch(
  () => props.tracks,
  async (newList) => {
    if (!newList || newList.length === 0) return
    const wasPlaying = isPlaying.value
    currentTrack.value = newList[0]
    await loadCurrentAudio(wasPlaying)
  },
  { immediate: true }
)

// 从「晴雨收藏夹」点播指定歌曲
watch(
  () => props.externalTrack,
  async (ext) => {
    if (!ext) return
    currentTrack.value = ext
    await loadCurrentAudio(true)
  }
)

watch(volume, (v) => {
  if (audioRef.value) {
    audioRef.value.volume = v
  }
})

async function loadCurrentAudio(autoPlay = false) {
  await nextTick()
  const el = audioRef.value
  if (!el || !currentTrack.value?.previewUrl) return
  el.pause()
  el.src = currentTrack.value.previewUrl
  el.volume = volume.value
  currentTime.value = 0
  duration.value = 30
  if (autoPlay) {
    try {
      await el.play()
    } catch {
      isPlaying.value = false
    }
  } else {
    isPlaying.value = false
  }
}

async function selectTrack(track, autoPlay = true) {
  if (currentTrack.value?.id === track.id) {
    togglePlay()
    return
  }
  currentTrack.value = track
  await loadCurrentAudio(autoPlay)
}

async function togglePlay() {
  const el = audioRef.value
  if (!el || !currentTrack.value) return
  if (el.paused) {
    try {
      await el.play()
    } catch {
      isPlaying.value = false
    }
  } else {
    el.pause()
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
  if (audioRef.value) {
    currentTime.value = audioRef.value.currentTime || 0
  }
}

function handleLoadedMetadata() {
  if (audioRef.value && Number.isFinite(audioRef.value.duration)) {
    duration.value = audioRef.value.duration
  }
}

function handleEnded() {
  playNext()
}

function handleAudioError() {
  isPlaying.value = false
}

function onSeek(val) {
  const num = Number(val)
  currentTime.value = num
  if (audioRef.value) {
    audioRef.value.currentTime = num
  }
}

function selectGenre(id) {
  songInput.value = ''
  emit('change-genre', id)
}

function submitCustomSong() {
  const q = songInput.value.trim()
  if (!q) return
  emit('custom-search', q)
}

function resetToSmart() {
  songInput.value = ''
  emit('reset-custom')
}

function formatSec(sec) {
  const s = Math.max(0, Math.floor(sec || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}
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
  font-size: 0.74rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--accent);
  color: #0f172a;
}

.query-chip {
  font-size: 0.73rem;
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
  width: 205px;
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
  font-size: 0.72rem;
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

/* 唱臂 */
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

/* 右侧控制器 */
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

.progress-area {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.time-text {
  font-size: 0.74rem;
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

.play-main-btn:hover {
  transform: scale(1.05);
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

/* 曲目列表 */
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
  font-size: 0.74rem;
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
  font-size: 0.74rem;
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
</style>
