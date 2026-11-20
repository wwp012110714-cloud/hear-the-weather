<template>
  <canvas ref="canvasRef" class="weather-canvas" aria-hidden="true"></canvas>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  skyTheme: {
    type: String,
    default: 'sunny-day'
  },
  enabled: {
    type: Boolean,
    default: true
  }
})

const canvasRef = ref(null)
let rafId = null
let particles = []
let width = 0
let height = 0
let flashOpacity = 0

function createParticles(theme) {
  const count =
    theme === 'rainy' || theme === 'storm'
      ? 95
      : theme === 'snowy'
      ? 68
      : theme === 'clear-night'
      ? 64
      : 36

  particles = Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: 1 + Math.random() * 2.6,
    speedY: 0.4 + Math.random() * 1.4,
    speedX: (Math.random() - 0.5) * 0.5,
    alpha: 0.2 + Math.random() * 0.55,
    phase: Math.random() * Math.PI * 2
  }))
}

function resize() {
  const canvas = canvasRef.value
  if (!canvas) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  width = window.innerWidth
  height = window.innerHeight
  canvas.width = width * dpr
  canvas.height = height * dpr
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  createParticles(props.skyTheme)
}

function render(ts) {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, width, height)

  if (!props.enabled) {
    rafId = requestAnimationFrame(render)
    return
  }

  const theme = props.skyTheme

  // 顶部柔光晕染
  if (theme === 'sunny-day') {
    const grad = ctx.createRadialGradient(width * 0.78, height * 0.12, 10, width * 0.78, height * 0.12, width * 0.48)
    grad.addColorStop(0, 'rgba(253, 224, 71, 0.18)')
    grad.addColorStop(1, 'rgba(253, 224, 71, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, height)
  }

  // 雷雨偶发远天微闪
  if (theme === 'storm') {
    if (Math.random() < 0.004) flashOpacity = 0.14
    if (flashOpacity > 0.002) {
      ctx.fillStyle = `rgba(224, 242, 254, ${flashOpacity})`
      ctx.fillRect(0, 0, width, height)
      flashOpacity *= 0.9
    }
  }

  for (const p of particles) {
    if (theme === 'rainy' || theme === 'storm') {
      const len = theme === 'storm' ? 20 : 14
      ctx.strokeStyle = `rgba(186, 230, 253, ${p.alpha * 0.55})`
      ctx.lineWidth = 1.15
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x - 3.2, p.y + len)
      ctx.stroke()

      p.y += 9 + p.speedY * 5
      p.x -= 2.2
      if (p.y > height) {
        p.y = -20
        p.x = Math.random() * (width + 120)
      }
    } else if (theme === 'snowy') {
      ctx.fillStyle = `rgba(240, 249, 255, ${p.alpha * 0.85})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fill()

      p.y += 0.55 + p.speedY * 0.65
      p.x += Math.sin(ts * 0.001 + p.phase) * 0.45
      if (p.y > height + 8) {
        p.y = -8
        p.x = Math.random() * width
      }
    } else if (theme === 'clear-night') {
      const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(ts * 0.0012 + p.phase))
      ctx.fillStyle = `rgba(254, 249, 195, ${p.alpha * twinkle})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r * 0.68, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // 晴昼或微云浮光微粒
      const glowColor = theme === 'sunny-day' ? '254, 240, 138' : '224, 242, 254'
      ctx.fillStyle = `rgba(${glowColor}, ${p.alpha * 0.28})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r * 1.1, 0, Math.PI * 2)
      ctx.fill()

      p.y -= 0.18 + p.speedY * 0.15
      p.x += Math.sin(ts * 0.0007 + p.phase) * 0.25
      if (p.y < -10) {
        p.y = height + 10
        p.x = Math.random() * width
      }
    }
  }

  rafId = requestAnimationFrame(render)
}

watch(
  () => props.skyTheme,
  (next) => {
    createParticles(next)
  }
)

onMounted(() => {
  resize()
  window.addEventListener('resize', resize)
  rafId = requestAnimationFrame(render)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  if (rafId) cancelAnimationFrame(rafId)
})
</script>

<style scoped>
.weather-canvas {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}
</style>
