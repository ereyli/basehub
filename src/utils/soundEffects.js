// CC0 Kenney casino audio files first, Web Audio fallback second.
// Source/license: public/sounds/kenney-casino/License.txt

class SoundManager {
  constructor() {
    this.audioContext = null
    this.enabled = true
    this._unlocked = false
    this.assetBase = '/sounds/kenney-casino'
    this.assets = {
      click: ['chip-lay-1.ogg', 'chip-lay-2.ogg'],
      win: ['chips-stack-1.ogg', 'chips-stack-2.ogg'],
      lose: ['chip-lay-2.ogg'],
      coinSpin: ['chips-collide-1.ogg', 'chips-collide-2.ogg'],
      coinReveal: ['chip-lay-1.ogg'],
      diceRoll: ['dice-shake-1.ogg', 'dice-shake-2.ogg'],
      diceReveal: ['dice-throw-1.ogg', 'dice-throw-2.ogg'],
      diceSelect: ['dice-grab-1.ogg'],
      numberSpin: ['chips-handle-1.ogg', 'chips-handle-2.ogg'],
      numberReveal: ['chips-stack-1.ogg'],
      numberSelect: ['chips-collide-1.ogg'],
      slotSpin: ['chips-handle-1.ogg', 'chips-handle-2.ogg'],
      slotStop: ['chips-collide-1.ogg', 'chips-collide-2.ogg'],
      slotWin: ['chips-stack-1.ogg', 'chips-stack-2.ogg']
    }
    this._setupUserGestureUnlock()
  }

  // Defer AudioContext creation until user gesture
  // This bypasses suspended policy on mobile WebView (Farcaster/Warpcast)
  _getOrCreateContext() {
    if (this.audioContext) return this.audioContext
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
    } catch (e) {
      console.warn('Web Audio API not supported:', e)
      this.enabled = false
      return null
    }
    return this.audioContext
  }

  _setupUserGestureUnlock() {
    if (typeof window === 'undefined') return
    const unlock = () => {
      const ctx = this._getOrCreateContext()
      if (!ctx) return
      // iOS WebView: always play a silent buffer during user gesture to warm up the audio path
      try {
        const buf = ctx.createBuffer(1, 1, ctx.sampleRate)
        const src = ctx.createBufferSource()
        src.buffer = buf
        src.connect(ctx.destination)
        src.start(0)
      } catch (_) {}
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          this._unlocked = true
          events.forEach(e => document.removeEventListener(e, handler, true))
        }).catch(() => {})
      } else {
        this._unlocked = true
        events.forEach(e => document.removeEventListener(e, handler, true))
      }
    }
    const events = ['touchstart', 'touchend', 'mousedown', 'click', 'keydown']
    const handler = () => unlock()
    events.forEach(e => document.addEventListener(e, handler, { capture: true, passive: true }))
  }

  ensureAudioContext() {
    const ctx = this._getOrCreateContext()
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
  }

  _now() {
    const ctx = this._getOrCreateContext()
    return ctx ? ctx.currentTime : 0
  }

  _ready() {
    if (!this.enabled) return false
    const ctx = this._getOrCreateContext()
    if (!ctx) return false
    // iOS Farcaster WebView: always try to resume — iOS may re-suspend between gestures
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    return ctx.state !== 'suspended' || this._unlocked
  }

  _createNoise(duration) {
    const ctx = this._getOrCreateContext()
    const bufferSize = ctx.sampleRate * duration
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buffer
    return src
  }

  _pickAsset(key) {
    const list = this.assets[key]
    if (!list || list.length === 0) return null
    return list[Math.floor(Math.random() * list.length)]
  }

  _playAsset(key, { volume = 0.55, playbackRate = 1, delay = 0 } = {}) {
    if (typeof window === 'undefined' || !this.enabled) return false
    const file = this._pickAsset(key)
    if (!file) return false

    const play = () => {
      try {
        const audio = new Audio(`${this.assetBase}/${file}`)
        audio.preload = 'auto'
        audio.volume = Math.max(0, Math.min(1, volume))
        audio.playbackRate = playbackRate
        const promise = audio.play()
        if (promise?.catch) promise.catch(() => {})
      } catch (_) {}
    }

    if (delay > 0) window.setTimeout(play, delay)
    else play()
    return true
  }

  _tone({ type = 'sine', frequency = 220, endFrequency, delay = 0, duration = 0.12, gain = 0.08, destination }) {
    if (!this._ready()) return
    const ctx = this._getOrCreateContext()
    const t = this._now() + delay
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g)
    g.connect(destination || ctx.destination)
    osc.type = type
    osc.frequency.setValueAtTime(frequency, t)
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, t + duration)
    g.gain.setValueAtTime(0.001, t)
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.018, duration * 0.25))
    g.gain.exponentialRampToValueAtTime(0.001, t + duration)
    osc.start(t)
    osc.stop(t + duration + 0.02)
  }

  _noiseHit({ duration = 0.08, gain = 0.08, filterType = 'lowpass', frequency = 420, endFrequency, q = 1.2, delay = 0 }) {
    if (!this._ready()) return
    const ctx = this._getOrCreateContext()
    const t = this._now() + delay
    const noise = this._createNoise(duration)
    const filter = ctx.createBiquadFilter()
    const g = ctx.createGain()
    noise.connect(filter); filter.connect(g); g.connect(ctx.destination)
    filter.type = filterType
    filter.frequency.setValueAtTime(frequency, t)
    if (endFrequency) filter.frequency.exponentialRampToValueAtTime(endFrequency, t + duration)
    filter.Q.setValueAtTime(q, t)
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + duration)
    noise.start(t)
    noise.stop(t + duration)
  }

  // ======================== SHARED ========================

  playClick() {
    if (this._playAsset('click', { volume: 0.34, playbackRate: 0.94 + Math.random() * 0.08 })) return
    if (!this._ready()) return
    this._noiseHit({ duration: 0.035, gain: 0.045, filterType: 'bandpass', frequency: 360, q: 2.2 })
    this._tone({ type: 'triangle', frequency: 190, endFrequency: 140, duration: 0.055, gain: 0.035 })
  }

  playWinSound() {
    this._playAsset('win', { volume: 0.6, playbackRate: 0.92 })
    this._playAsset('win', { volume: 0.42, playbackRate: 1.05, delay: 120 })
    return
    if (!this._ready()) return
    this._noiseHit({ duration: 0.11, gain: 0.055, filterType: 'highpass', frequency: 900, q: 0.8 })
    ;[262, 330, 392, 523].forEach((freq, i) => {
      this._tone({ type: 'triangle', frequency: freq, endFrequency: freq * 0.96, delay: i * 0.085, duration: 0.28, gain: 0.075 })
    })
    this._tone({ type: 'sine', frequency: 1046, endFrequency: 880, delay: 0.24, duration: 0.34, gain: 0.025 })
  }

  playLoseSound() {
    if (this._playAsset('lose', { volume: 0.36, playbackRate: 0.82 })) return
    if (!this._ready()) return
    this._noiseHit({ duration: 0.13, gain: 0.04, filterType: 'lowpass', frequency: 360, endFrequency: 120, q: 0.9 })
    this._tone({ type: 'triangle', frequency: 196, endFrequency: 112, duration: 0.45, gain: 0.065 })
  }

  // ======================== COIN FLIP — Casino/Metallic ========================

  playCoinSpin() {
    if (this._playAsset('coinSpin', { volume: 0.42, playbackRate: 0.88 + Math.random() * 0.16 })) return
    if (!this._ready()) return
    this._noiseHit({ duration: 0.045, gain: 0.04, filterType: 'bandpass', frequency: 1150 + Math.random() * 240, q: 8 })
    this._tone({ type: 'triangle', frequency: 360 + Math.random() * 90, endFrequency: 230, duration: 0.075, gain: 0.035 })
  }

  playResultReveal() {
    if (this._playAsset('coinReveal', { volume: 0.56, playbackRate: 0.88 })) return
    if (!this._ready()) return
    this._noiseHit({ duration: 0.09, gain: 0.075, filterType: 'lowpass', frequency: 620, endFrequency: 190, q: 1.1 })
    this._tone({ type: 'triangle', frequency: 392, endFrequency: 330, duration: 0.32, gain: 0.075 })
    this._tone({ type: 'sine', frequency: 784, endFrequency: 660, delay: 0.035, duration: 0.22, gain: 0.035 })
  }

  startCoinSpinLoop() {
    if (!this._ready()) return null
    this.playCoinSpin()
    const interval = setInterval(() => {
      this.playCoinSpin()
    }, 280)
    return interval
  }

  stopCoinSpinLoop(interval) { if (interval) clearInterval(interval) }

  // ======================== DICE ROLL — Wooden Table ========================

  playDiceRoll() {
    if (this._playAsset('diceRoll', { volume: 0.42, playbackRate: 0.86 + Math.random() * 0.12 })) return
    if (!this._ready()) return
    this._noiseHit({ duration: 0.075, gain: 0.09, filterType: 'lowpass', frequency: 520 + Math.random() * 170, endFrequency: 160, q: 1.5 })
    this._tone({ type: 'triangle', frequency: 150 + Math.random() * 45, endFrequency: 82, duration: 0.07, gain: 0.06 })
  }

  playDiceReveal() {
    if (this._playAsset('diceReveal', { volume: 0.62, playbackRate: 0.9 + Math.random() * 0.08 })) return
    if (!this._ready()) return
    this._noiseHit({ duration: 0.19, gain: 0.13, filterType: 'lowpass', frequency: 430, endFrequency: 95, q: 1 })
    this._tone({ type: 'sine', frequency: 115, endFrequency: 58, duration: 0.28, gain: 0.09 })

    // Bounce — secondary smaller thud
    setTimeout(() => {
      if (!this._ready()) return
      this._noiseHit({ duration: 0.055, gain: 0.048, filterType: 'lowpass', frequency: 230, q: 1.1 })
    }, 150)
  }

  playDiceSelect() {
    if (this._playAsset('diceSelect', { volume: 0.32, playbackRate: 0.95 })) return
    if (!this._ready()) return
    this._noiseHit({ duration: 0.04, gain: 0.055, filterType: 'bandpass', frequency: 430, q: 3 })
  }

  startDiceRollLoop() {
    if (!this._ready()) return null
    this.playDiceRoll()
    const interval = setInterval(() => {
      this.playDiceRoll()
    }, 260)
    return interval
  }

  stopDiceRollLoop(interval) { if (interval) clearInterval(interval) }

  // ======================== LUCKY NUMBER — Magical/Mystical ========================

  playNumberSpin() {
    if (this._playAsset('numberSpin', { volume: 0.4, playbackRate: 0.92 + Math.random() * 0.12 })) return
    if (!this._ready()) return
    this._noiseHit({ duration: 0.055, gain: 0.055, filterType: 'bandpass', frequency: 520 + Math.random() * 260, q: 4.5 })
    this._tone({ type: 'triangle', frequency: 210 + Math.random() * 70, endFrequency: 155, duration: 0.06, gain: 0.035 })
  }

  playNumberReveal() {
    if (this._playAsset('numberReveal', { volume: 0.56, playbackRate: 0.94 })) return
    if (!this._ready()) return
    this._noiseHit({ duration: 0.12, gain: 0.08, filterType: 'bandpass', frequency: 680, q: 2.8 })
    this._tone({ type: 'triangle', frequency: 262, endFrequency: 330, duration: 0.2, gain: 0.06 })
    this._tone({ type: 'triangle', frequency: 392, endFrequency: 523, delay: 0.08, duration: 0.24, gain: 0.052 })
  }

  playNumberSelect() {
    if (this._playAsset('numberSelect', { volume: 0.28, playbackRate: 1.05 })) return
    if (!this._ready()) return
    this._noiseHit({ duration: 0.04, gain: 0.05, filterType: 'bandpass', frequency: 620, q: 3.5 })
    this._tone({ type: 'triangle', frequency: 260, endFrequency: 210, duration: 0.055, gain: 0.03 })
  }

  startNumberSpinLoop() {
    if (!this._ready()) return null
    this.playNumberSpin()
    const interval = setInterval(() => {
      this.playNumberSpin()
    }, 240)
    return interval
  }

  stopNumberSpinLoop(interval) { if (interval) clearInterval(interval) }

  playSlotSpin() {
    this._playAsset('slotSpin', { volume: 0.44, playbackRate: 0.86 + Math.random() * 0.08 })
  }

  playSlotStop() {
    this._playAsset('slotStop', { volume: 0.42, playbackRate: 0.9 + Math.random() * 0.1 })
  }

  playSlotWin() {
    this._playAsset('slotWin', { volume: 0.62, playbackRate: 0.9 })
    this._playAsset('slotWin', { volume: 0.48, playbackRate: 1.04, delay: 150 })
  }
}

const soundManager = new SoundManager()
export default soundManager
