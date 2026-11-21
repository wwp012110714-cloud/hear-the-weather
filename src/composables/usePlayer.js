/**
 * 全局唯一播放器（三种视图共用同一首歌、同一进度）
 * 播放兼容链路沿用第 9 次提交的三级方案：
 *  A. FM 直播 / Deezer MP3：<audio> 原生播放
 *  B. iTunes 试听：fetch 字节 → Blob(audio/mp4) → <audio>
 *  C. <audio> 拒绝解码时：Web Audio decodeAudioData 软解
 *
 * 切歌规则（修复「页面换了歌、声音还是上一首」）：
 *  - 一旦开始切歌，立刻清空 <audio> 里的旧音源，并把状态置为「缓冲中」而不是「正在播放」
 *  - loadedId 记录 <audio> 里实际装的是哪首歌；只有和当前歌一致时，按「播放」才会续播
 *  - 缓冲中再按播放键 = 取消这次加载
 *  - 每首歌开始播放后，后台预下载歌单里接下来的两首，网络慢时切歌也能立刻出声
 */
import { ref, computed } from 'vue'
import { refreshDeezerPreview } from '../services/api'

const queue = ref([])
const currentTrack = ref(null)
const isPlaying = ref(false)
const buffering = ref(false)
const notice = ref('')
const currentTime = ref(0)
const duration = ref(30)
const volume = ref(0.85)

let el = null
let objectUrl = null
let ctx = null
let srcNode = null
let gainNode = null
let startedAt = 0
let ticker = null
let token = 0
let loadedId = null // <audio> / Web Audio 里实际装载的歌曲 id
const pending = ref(false) // 正在为当前歌下载、解码、起播

// 试听音频预取缓存：id → ArrayBuffer（最多保留 6 首）
const bufCache = new Map()
const inflight = new Map()

function remember(id, buf) {
  bufCache.delete(id)
  bufCache.set(id, buf)
  while (bufCache.size > 6) bufCache.delete(bufCache.keys().next().value)
}

function fetchPreview(track, timeoutMs = 12000) {
  if (bufCache.has(track.id)) return Promise.resolve(bufCache.get(track.id))
  if (inflight.has(track.id)) return inflight.get(track.id)
  const job = (async () => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const resp = await fetch(track.previewUrl, { signal: ctrl.signal })
      if (!resp.ok) return null
      const buf = await resp.arrayBuffer()
      if (buf.byteLength <= 512) return null
      remember(track.id, buf)
      return buf
    } catch {
      return null
    } finally {
      clearTimeout(t)
      inflight.delete(track.id)
    }
  })()
  inflight.set(track.id, job)
  return job
}

function prefetchAhead() {
  const list = queue.value
  if (list.length < 2) return
  const i = list.findIndex((t) => t.id === currentTrack.value?.id)
  for (const k of [1, 2]) {
    const t = list[(i + k + list.length) % list.length]
    if (t && t.previewUrl && !t.isLiveStream && t.id !== currentTrack.value?.id) fetchPreview(t)
  }
}

/** 彻底卸下 <audio> 里的旧音源，之后无论怎么按播放都不会再响起旧歌 */
function unload() {
  if (!el) return
  el.pause()
  el.removeAttribute('src')
  try {
    el.load()
  } catch {
    /* 无需处理 */
  }
  loadedId = null
}

function audio() {
  if (el) return el
  el = new Audio()
  el.preload = 'none'
  el.addEventListener('timeupdate', () => {
    if (!srcNode) currentTime.value = el.currentTime || 0
  })
  el.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(el.duration) && el.duration > 0) duration.value = el.duration
  })
  el.addEventListener('ended', () => {
    if (loadedId && loadedId === currentTrack.value?.id && !currentTrack.value?.isLiveStream) next()
  })
  el.addEventListener('waiting', () => (buffering.value = true))
  el.addEventListener('playing', () => (buffering.value = false))
  return el
}

function cleanup() {
  if (ticker) {
    clearInterval(ticker)
    ticker = null
  }
  if (srcNode) {
    try {
      srcNode.onended = null
      srcNode.stop()
      srcNode.disconnect()
    } catch {
      /* 已停止 */
    }
    srcNode = null
  }
  if (el) el.pause()
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = null
  }
}

async function viaWebAudio(buf, my, id) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return false
    if (!ctx) ctx = new Ctx()
    if (ctx.state === 'suspended') await ctx.resume()
    const decoded = await ctx.decodeAudioData(buf.slice(0))
    if (my !== token) return false
    gainNode = ctx.createGain()
    gainNode.gain.value = volume.value
    gainNode.connect(ctx.destination)
    const s = ctx.createBufferSource()
    s.buffer = decoded
    s.connect(gainNode)
    duration.value = decoded.duration || 30
    startedAt = ctx.currentTime
    srcNode = s
    loadedId = id
    isPlaying.value = true
    ticker = setInterval(() => {
      if (ctx && isPlaying.value) currentTime.value = Math.min(duration.value, ctx.currentTime - startedAt)
    }, 200)
    s.onended = () => {
      if (my === token && isPlaying.value) next()
    }
    s.start(0)
    return true
  } catch {
    return false
  }
}

async function start(track) {
  if (!track?.previewUrl) return
  const my = ++token
  cleanup()
  unload()
  const a = audio()
  currentTrack.value = track
  isPlaying.value = false
  pending.value = true
  buffering.value = true
  notice.value = ''
  currentTime.value = 0
  duration.value = track.isLiveStream ? 0 : 30

  const started = () => {
    loadedId = track.id
    isPlaying.value = true
    buffering.value = false
    pending.value = false
    prefetchAhead()
  }

  try {
    // Deezer 试听链接有时效，超过 10 分钟先换一个新链接（例如从收藏簿播放）
    if (track.dzId && Date.now() - (track.fetchedAt || 0) > 10 * 60 * 1000) {
      try {
        const fresh = await refreshDeezerPreview(track)
        if (my !== token) return
        track = fresh
        currentTrack.value = fresh
      } catch {
        /* 用旧链接试试 */
      }
    }

    // Deezer MP3：已预下载就用内存里的数据，立即出声
    if (track.directPlay && bufCache.has(track.id)) {
      objectUrl = URL.createObjectURL(new Blob([bufCache.get(track.id)], { type: 'audio/mpeg' }))
      a.src = objectUrl
      a.volume = volume.value
      await a.play()
      if (my !== token) return
      started()
      return
    }

    if (track.isLiveStream || track.directPlay) {
      a.src = track.previewUrl
      a.volume = volume.value
      await a.play()
      if (my !== token) return
      started()
      return
    }

    const buf = await fetchPreview(track, 12000)
    if (my !== token) return

    if (buf) {
      objectUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/mp4' }))
      a.src = objectUrl
    } else {
      a.src = track.previewUrl
    }
    a.volume = volume.value
    try {
      await a.play()
      if (my !== token) return
      started()
    } catch (err) {
      if (my !== token) return
      if (buf && (await viaWebAudio(buf, my, track.id))) {
        started()
        return
      }
      throw err
    }
  } catch {
    if (my !== token) return
    unload()
    isPlaying.value = false
    buffering.value = false
    pending.value = false
    notice.value = track.isLiveStream
      ? '这个电台暂时连不上，点「下一首」换一个台。'
      : '这首歌的试听在当前网络下没能加载出来，点「下一首」换一首，或稍后再试。'
  }
}

/** 取消正在进行的加载（缓冲中再按播放键） */
function cancelPending() {
  token++
  cleanup()
  unload()
  pending.value = false
  buffering.value = false
  isPlaying.value = false
}

async function toggle() {
  if (!currentTrack.value) return
  if (pending.value) return cancelPending()
  if (srcNode) {
    cleanup()
    isPlaying.value = false
    return
  }
  const a = audio()
  if (isPlaying.value && !a.paused) {
    a.pause()
    isPlaying.value = false
  } else if (loadedId === currentTrack.value.id && a.getAttribute('src') && !currentTrack.value.isLiveStream) {
    try {
      await a.play()
      isPlaying.value = true
    } catch {
      await start(currentTrack.value)
    }
  } else {
    await start(currentTrack.value)
  }
}

function play(track) {
  if (currentTrack.value?.id === track?.id) return toggle()
  return start(track)
}

function step(dir) {
  const list = queue.value
  if (!list.length) return
  const i = list.findIndex((t) => t.id === currentTrack.value?.id)
  const n = i < 0 ? 0 : (i + dir + list.length) % list.length
  start(list[n])
}

function next() {
  step(1)
}

function prev() {
  step(-1)
}

function seek(sec) {
  const v = Number(sec)
  if (!Number.isFinite(v) || srcNode || currentTrack.value?.isLiveStream) return
  currentTime.value = v
  if (el) el.currentTime = v
}

function setVolume(v) {
  volume.value = v
  if (el) el.volume = v
  if (gainNode && ctx) gainNode.gain.setValueAtTime(v, ctx.currentTime)
}

/** 新歌单到来：正在播放则无缝切到新歌单第一首，否则只预选 */
async function setQueue(list) {
  queue.value = list || []
  if (!queue.value.length) return
  if (isPlaying.value || pending.value) {
    await start(queue.value[0])
  } else {
    token++
    cleanup()
    unload()
    currentTrack.value = queue.value[0]
    currentTime.value = 0
    duration.value = queue.value[0].isLiveStream ? 0 : 30
    notice.value = ''
  }
}

function dispose() {
  cleanup()
  if (ctx) {
    ctx.close().catch(() => {})
    ctx = null
  }
}

export function formatSec(sec) {
  const s = Math.max(0, Math.floor(sec || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function usePlayer() {
  return {
    queue,
    currentTrack,
    isPlaying,
    pending,
    buffering,
    notice,
    currentTime,
    duration,
    volume,
    progress: computed(() => (duration.value ? Math.min(1, currentTime.value / duration.value) : 0)),
    play,
    start,
    toggle,
    next,
    prev,
    seek,
    setVolume,
    setQueue,
    dispose
  }
}
