/**
 * 浏览器原生 Web Audio API 实时天气环境声合成引擎
 * 无需外部音频素材文件，根据城市实时降雨、风速、寒冷度与晴空动态生成四路自然白噪音：
 * - rain: 细雨敲窗（滤波粉红噪声 + 随机水滴脉冲）
 * - wind: 微风拂叶（LFO 慢速调制带通流风）
 * - hearth: 围炉暖火（低频暖流 + 随机木柴轻响）
 * - chimes: 晴空风铃（五声音阶泛音轻鸣）
 */
export class WeatherSoundscape {
  constructor() {
    this.ctx = null
    this.masterGain = null
    this.layers = {}
    this.running = false
    this.chimeTimer = null
    this.crackleTimer = null
    this.mix = { rain: 0, wind: 20, hearth: 0, chimes: 0 }
    this.masterVolume = 0.55
  }

  init() {
    if (this.ctx) return
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    this.ctx = new AudioCtx()
    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 0
    this.masterGain.connect(this.ctx.destination)

    const noiseBuffer = this.createPinkNoiseBuffer(4)

    // 1. 细雨层
    const rainSrc = this.ctx.createBufferSource()
    rainSrc.buffer = noiseBuffer
    rainSrc.loop = true
    const rainFilter = this.ctx.createBiquadFilter()
    rainFilter.type = 'bandpass'
    rainFilter.frequency.value = 1350
    rainFilter.Q.value = 0.65
    const rainGain = this.ctx.createGain()
    rainGain.gain.value = 0
    rainSrc.connect(rainFilter)
    rainFilter.connect(rainGain)
    rainGain.connect(this.masterGain)
    rainSrc.start()

    // 2. 微风层（带 LFO 呼吸起伏）
    const windSrc = this.ctx.createBufferSource()
    windSrc.buffer = noiseBuffer
    windSrc.loop = true
    const windFilter = this.ctx.createBiquadFilter()
    windFilter.type = 'bandpass'
    windFilter.frequency.value = 380
    windFilter.Q.value = 3.2

    const windLfo = this.ctx.createOscillator()
    windLfo.type = 'sine'
    windLfo.frequency.value = 0.14
    const windLfoGain = this.ctx.createGain()
    windLfoGain.gain.value = 210
    windLfo.connect(windLfoGain)
    windLfoGain.connect(windFilter.frequency)
    windLfo.start()

    const windGain = this.ctx.createGain()
    windGain.gain.value = 0
    windSrc.connect(windFilter)
    windFilter.connect(windGain)
    windGain.connect(this.masterGain)
    windSrc.start()

    // 3. 冬夜壁炉暖流层
    const hearthSrc = this.ctx.createBufferSource()
    hearthSrc.buffer = noiseBuffer
    hearthSrc.loop = true
    const hearthFilter = this.ctx.createBiquadFilter()
    hearthFilter.type = 'lowpass'
    hearthFilter.frequency.value = 210
    const hearthGain = this.ctx.createGain()
    hearthGain.gain.value = 0
    hearthSrc.connect(hearthFilter)
    hearthFilter.connect(hearthGain)
    hearthGain.connect(this.masterGain)
    hearthSrc.start()

    this.layers = {
      rain: rainGain,
      wind: windGain,
      hearth: hearthGain
    }

    this.startStochasticTriggers()
  }

  createPinkNoiseBuffer(seconds = 4) {
    const length = this.ctx.sampleRate * seconds
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
    const out = buffer.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.96900 * b2 + white * 0.1538520
      b3 = 0.86650 * b3 + white * 0.3104856
      b4 = 0.55000 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.0168980
      out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045
      b6 = white * 0.115926
    }
    return buffer
  }

  startStochasticTriggers() {
    // 晴空五声风铃泛音 (宫商角徵羽)
    const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]
    this.chimeTimer = setInterval(() => {
      if (!this.running || !this.ctx || this.mix.chimes <= 2) return
      const chance = (this.mix.chimes / 100) * 0.55
      if (Math.random() > chance) return

      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const freq = pentatonic[Math.floor(Math.random() * pentatonic.length)]
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now)

      const peak = (this.mix.chimes / 100) * 0.065
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), now + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4)

      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start(now)
      osc.stop(now + 2.5)
    }, 1500)

    // 柴火细微噼啪声与雨滴敲击声
    this.crackleTimer = setInterval(() => {
      if (!this.running || !this.ctx) return
      const now = this.ctx.currentTime

      if (this.mix.hearth > 8 && Math.random() < (this.mix.hearth / 100) * 0.65) {
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(120 + Math.random() * 480, now)
        const vol = (this.mix.hearth / 100) * 0.04
        gain.gain.setValueAtTime(vol, now)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045)
        osc.connect(gain)
        gain.connect(this.masterGain)
        osc.start(now)
        osc.stop(now + 0.05)
      }

      if (this.mix.rain > 15 && Math.random() < (this.mix.rain / 100) * 0.55) {
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(900 + Math.random() * 900, now)
        const vol = (this.mix.rain / 100) * 0.018
        gain.gain.setValueAtTime(vol, now)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035)
        osc.connect(gain)
        gain.connect(this.masterGain)
        osc.start(now)
        osc.stop(now + 0.04)
      }
    }, 260)
  }

  async start() {
    this.init()
    if (!this.ctx) return
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }
    this.running = true
    this.applyGains()
  }

  stop() {
    this.running = false
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.18)
    }
  }

  setMix(newMix) {
    this.mix = { ...this.mix, ...newMix }
    if (this.running) {
      this.applyGains()
    }
  }

  setMasterVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol))
    if (this.running) {
      this.applyGains()
    }
  }

  applyGains() {
    if (!this.ctx || !this.masterGain) return
    const now = this.ctx.currentTime
    this.masterGain.gain.setTargetAtTime(this.running ? this.masterVolume : 0, now, 0.2)
    if (this.layers.rain) {
      this.layers.rain.gain.setTargetAtTime((this.mix.rain / 100) * 0.42, now, 0.25)
    }
    if (this.layers.wind) {
      this.layers.wind.gain.setTargetAtTime((this.mix.wind / 100) * 0.48, now, 0.25)
    }
    if (this.layers.hearth) {
      this.layers.hearth.gain.setTargetAtTime((this.mix.hearth / 100) * 0.55, now, 0.25)
    }
  }

  dispose() {
    this.stop()
    if (this.chimeTimer) clearInterval(this.chimeTimer)
    if (this.crackleTimer) clearInterval(this.crackleTimer)
    if (this.ctx) {
      this.ctx.close().catch(() => {})
      this.ctx = null
    }
  }
}
