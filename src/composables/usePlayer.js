/**
 * 全局唯一播放器（三种视图共用同一首歌、同一进度）
 * 播放兼容链路沿用第 9 次提交的三级方案：
 *  A. FM 直播 / Deezer MP3：<audio> 原生播放
 *  B. iTunes 试听：fetch 字节 → Blob(audio/mp4) → <audio>
 *  C. <audio> 拒绝解码时：Web Audio decodeAudioData 软解
 */
import { ref, computed } from 'vue'

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
    if (!currentTrack.value?.isLiveStream) next()
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

async function viaWebAudio(buf, my) {
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
  const a = audio()
  currentTrack.value = track
  buffering.value = true
  notice.value = ''
  currentTime.value = 0
  duration.value = track.isLiveStream ? 0 : 30

  try {
    if (track.isLiveStream || track.directPlay) {
      a.src = track.previewUrl
      a.volume = volume.value
      await a.play()
      if (my !== token) return
      isPlaying.value = true
      buffering.value = false
      return
    }

    let buf = null
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 9000)
      try {
        const resp = await fetch(track.previewUrl, { signal: ctrl.signal })
        if (resp.ok) buf = await resp.arrayBuffer()
      } finally {
        clearTimeout(t)
      }
    } catch {
      buf = null
    }
    if (my !== token) return

    if (buf && buf.byteLength > 512) {
      objectUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/mp4' }))
      a.src = objectUrl
    } else {
      a.src = track.previewUrl
    }
    a.volume = volume.value
    try {
      await a.play()
      if (my !== token) return
      isPlaying.value = true
      buffering.value = false
    } catch (err) {
      if (buf && (await viaWebAudio(buf, my))) {
        buffering.value = false
        return
      }
      throw err
    }
  } catch {
    if (my !== token) return
    isPlaying.value = false
    buffering.value = false
    notice.value = '这首歌的试听音频在当前网络下解码失败。换一首，或在下方「电台」切到国内 FM 直播。'
  }
}

async function toggle() {
  if (!currentTrack.value) return
  if (srcNode) {
    cleanup()
    isPlaying.value = false
    return
  }
  const a = audio()
  if (isPlaying.value && !a.paused) {
    a.pause()
    isPlaying.value = false
  } else if (a.src && a.currentTime > 0 && !currentTrack.value.isLiveStream) {
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
  if (isPlaying.value) {
    await start(queue.value[0])
  } else {
    cleanup()
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
