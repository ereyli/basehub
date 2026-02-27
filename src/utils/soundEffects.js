// Sound effects with Web Audio API — distinct character per game
// Coin Flip: metallic/casino | Dice Roll: wooden table thud | Lucky Number: magical/mystical

class SoundManager {
  constructor() {
    this.audioContext = null
    this.enabled = true
    this._unlocked = false
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

  // ======================== SHARED ========================

  playClick() {
    if (!this._ready()) return
    const t = this._now()
    const ctx = this._getOrCreateContext()

    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, t)
    osc.frequency.exponentialRampToValueAtTime(660, t + 0.04)
    g.gain.setValueAtTime(0.06, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
    osc.start(t); osc.stop(t + 0.06)
  }

  playWinSound() {
    if (!this._ready()) return
    const t = this._now()
    const ctx = this._getOrCreateContext()

    // Triumphant ascending arpeggio: C5-E5-G5-C6
    const notes = [523, 659, 784, 1047]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.connect(g); g.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, t + i * 0.1)

      const start = t + i * 0.1
      g.gain.setValueAtTime(0.001, start)
      g.gain.linearRampToValueAtTime(0.12, start + 0.05)
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.5)
      osc.start(start); osc.stop(start + 0.5)
    })

    // Shimmer layer
    const shimmer = ctx.createOscillator()
    const sg = ctx.createGain()
    shimmer.connect(sg); sg.connect(ctx.destination)
    shimmer.type = 'sine'
    shimmer.frequency.setValueAtTime(2093, t + 0.35)
    shimmer.frequency.exponentialRampToValueAtTime(1568, t + 1.0)
    sg.gain.setValueAtTime(0.001, t + 0.35)
    sg.gain.linearRampToValueAtTime(0.06, t + 0.45)
    sg.gain.exponentialRampToValueAtTime(0.001, t + 1.0)
    shimmer.start(t + 0.35); shimmer.stop(t + 1.0)
  }

  playLoseSound() {
    if (!this._ready()) return
    const t = this._now()
    const ctx = this._getOrCreateContext()

    // Gentle descending two-note: "wah-wah"
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(440, t)
    osc.frequency.linearRampToValueAtTime(330, t + 0.2)
    osc.frequency.linearRampToValueAtTime(260, t + 0.5)
    g.gain.setValueAtTime(0.08, t)
    g.gain.linearRampToValueAtTime(0.04, t + 0.25)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
    osc.start(t); osc.stop(t + 0.6)
  }

  // ======================== COIN FLIP — Casino/Metallic ========================

  playCoinSpin() {
    if (!this._ready()) return
    const t = this._now()
    const ctx = this._getOrCreateContext()

    // Metallic ring: two detuned sine waves for shimmer
    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const g = ctx.createGain()
    osc1.connect(g); osc2.connect(g); g.connect(ctx.destination)

    osc1.type = 'sine'
    osc2.type = 'sine'
    const base = 1200 + Math.random() * 400
    osc1.frequency.setValueAtTime(base, t)
    osc2.frequency.setValueAtTime(base * 1.005, t) // slight detune
    osc1.frequency.exponentialRampToValueAtTime(base * 0.7, t + 0.12)
    osc2.frequency.exponentialRampToValueAtTime(base * 0.7 * 1.005, t + 0.12)

    g.gain.setValueAtTime(0.04, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
    osc1.start(t); osc2.start(t)
    osc1.stop(t + 0.12); osc2.stop(t + 0.12)
  }

  playResultReveal() {
    if (!this._ready()) return
    const t = this._now()
    const ctx = this._getOrCreateContext()

    // Casino "ding" — bright bell
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1318, t) // E6
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.6)
    g.gain.setValueAtTime(0.15, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
    osc.start(t); osc.stop(t + 0.6)

    // Harmonic overtone
    const osc2 = ctx.createOscillator()
    const g2 = ctx.createGain()
    osc2.connect(g2); g2.connect(ctx.destination)
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(2636, t) // E7
    g2.gain.setValueAtTime(0.04, t)
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
    osc2.start(t); osc2.stop(t + 0.35)
  }

  startCoinSpinLoop() {
    if (!this._ready()) return null
    let speed = 220
    const interval = setInterval(() => {
      this.playCoinSpin()
      if (speed > 120) speed -= 8
    }, speed)
    return interval
  }

  stopCoinSpinLoop(interval) { if (interval) clearInterval(interval) }

  // ======================== DICE ROLL — Wooden Table ========================

  playDiceRoll() {
    if (!this._ready()) return
    const t = this._now()
    const ctx = this._getOrCreateContext()

    // Wooden knock/thud via filtered noise burst
    const noise = this._createNoise(0.08)
    const filter = ctx.createBiquadFilter()
    const g = ctx.createGain()
    noise.connect(filter); filter.connect(g); g.connect(ctx.destination)

    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(300 + Math.random() * 200, t)
    filter.Q.setValueAtTime(2, t)

    g.gain.setValueAtTime(0.12, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
    noise.start(t); noise.stop(t + 0.08)

    // Subtle resonant tap
    const osc = ctx.createOscillator()
    const og = ctx.createGain()
    osc.connect(og); og.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(180 + Math.random() * 60, t)
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.06)
    og.gain.setValueAtTime(0.06, t)
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
    osc.start(t); osc.stop(t + 0.06)
  }

  playDiceReveal() {
    if (!this._ready()) return
    const t = this._now()
    const ctx = this._getOrCreateContext()

    // Heavy landing thud
    const noise = this._createNoise(0.2)
    const filter = ctx.createBiquadFilter()
    const g = ctx.createGain()
    noise.connect(filter); filter.connect(g); g.connect(ctx.destination)
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(400, t)
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.2)
    g.gain.setValueAtTime(0.15, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
    noise.start(t); noise.stop(t + 0.2)

    // Low impact tone
    const osc = ctx.createOscillator()
    const og = ctx.createGain()
    osc.connect(og); og.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(120, t)
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.25)
    og.gain.setValueAtTime(0.1, t)
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
    osc.start(t); osc.stop(t + 0.3)

    // Bounce — secondary smaller thud
    setTimeout(() => {
      if (!this._ready()) return
      const ctx2 = this._getOrCreateContext()
      if (!ctx2) return
      const t2 = this._now()
      const n2 = this._createNoise(0.06)
      const f2 = ctx2.createBiquadFilter()
      const g2 = ctx.createGain()
      n2.connect(f2); f2.connect(g2); g2.connect(ctx2.destination)
      f2.type = 'lowpass'; f2.frequency.setValueAtTime(250, t2)
      g2.gain.setValueAtTime(0.06, t2)
      g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.06)
      n2.start(t2); n2.stop(t2 + 0.06)
    }, 150)
  }

  playDiceSelect() {
    if (!this._ready()) return
    const t = this._now()
    const ctx = this._getOrCreateContext()

    // Small wooden tap
    const noise = this._createNoise(0.04)
    const filter = ctx.createBiquadFilter()
    const g = ctx.createGain()
    noise.connect(filter); filter.connect(g); g.connect(ctx.destination)
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(600, t)
    filter.Q.setValueAtTime(3, t)
    g.gain.setValueAtTime(0.06, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04)
    noise.start(t); noise.stop(t + 0.04)
  }

  startDiceRollLoop() {
    if (!this._ready()) return null
    const interval = setInterval(() => {
      this.playDiceRoll()
    }, 180)
    return interval
  }

  stopDiceRollLoop(interval) { if (interval) clearInterval(interval) }

  // ======================== LUCKY NUMBER — Magical/Mystical ========================

  playNumberSpin() {
    if (!this._ready()) return
    const t = this._now()
    const ctx = this._getOrCreateContext()

    // Magical chime: ascending tone with vibrato
    const osc = ctx.createOscillator()
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    const g = ctx.createGain()

    lfo.connect(lfoGain); lfoGain.connect(osc.frequency)
    osc.connect(g); g.connect(ctx.destination)

    const base = 600 + Math.random() * 600
    osc.type = 'sine'
    osc.frequency.setValueAtTime(base, t)
    osc.frequency.exponentialRampToValueAtTime(base * 0.8, t + 0.15)

    lfo.type = 'sine'
    lfo.frequency.setValueAtTime(12, t)
    lfoGain.gain.setValueAtTime(15, t)

    g.gain.setValueAtTime(0.05, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15)

    osc.start(t); lfo.start(t)
    osc.stop(t + 0.15); lfo.stop(t + 0.15)
  }

  playNumberReveal() {
    if (!this._ready()) return
    const t = this._now()
    const ctx = this._getOrCreateContext()

    // Magical reveal: rising sparkle arpeggio
    const notes = [523, 784, 1047, 1568] // C5, G5, C6, G6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.connect(g); g.connect(ctx.destination)
      osc.type = 'sine'

      const start = t + i * 0.06
      osc.frequency.setValueAtTime(freq, start)
      g.gain.setValueAtTime(0.001, start)
      g.gain.linearRampToValueAtTime(0.08, start + 0.03)
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.35)
      osc.start(start); osc.stop(start + 0.35)
    })

    // Sparkle shimmer (high-frequency wash)
    const shimmer = ctx.createOscillator()
    const sg = ctx.createGain()
    shimmer.connect(sg); sg.connect(ctx.destination)
    shimmer.type = 'sine'
    shimmer.frequency.setValueAtTime(3136, t + 0.2)
    shimmer.frequency.exponentialRampToValueAtTime(2093, t + 0.8)
    sg.gain.setValueAtTime(0.001, t + 0.2)
    sg.gain.linearRampToValueAtTime(0.04, t + 0.3)
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.8)
    shimmer.start(t + 0.2); shimmer.stop(t + 0.8)
  }

  playNumberSelect() {
    if (!this._ready()) return
    const t = this._now()
    const ctx = this._getOrCreateContext()

    // Soft magical "ping" — two quick harmonics
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1047, t) // C6
    osc.frequency.exponentialRampToValueAtTime(784, t + 0.08)
    g.gain.setValueAtTime(0.05, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
    osc.start(t); osc.stop(t + 0.1)
  }

  startNumberSpinLoop() {
    if (!this._ready()) return null
    const interval = setInterval(() => {
      this.playNumberSpin()
    }, 160)
    return interval
  }

  stopNumberSpinLoop(interval) { if (interval) clearInterval(interval) }
}

const soundManager = new SoundManager()
export default soundManager
