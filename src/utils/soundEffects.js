// Sound effects utility for coin flip game
// Uses Web Audio API to generate sounds programmatically

class SoundManager {
  constructor() {
    this.audioContext = null
    this.enabled = true
    this.initAudioContext()
  }

  initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
    } catch (e) {
      console.warn('Web Audio API not supported:', e)
      this.enabled = false
    }
  }

  // Ensure audio context is running (required for some browsers)
  ensureAudioContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume()
    }
  }

  // Generate coin spin sound (metallic spinning)
  playCoinSpin() {
    if (!this.enabled || !this.audioContext) return

    this.ensureAudioContext()

    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    // Metallic spinning sound - slower and smoother
    oscillator.type = 'sawtooth'
    oscillator.frequency.setValueAtTime(180, this.audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(140, this.audioContext.currentTime + 0.2)

    gainNode.gain.setValueAtTime(0.08, this.audioContext.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.02, this.audioContext.currentTime + 0.2)

    oscillator.start(this.audioContext.currentTime)
    oscillator.stop(this.audioContext.currentTime + 0.2)
  }

  // Generate result reveal sound (ding)
  playResultReveal() {
    if (!this.enabled || !this.audioContext) return

    this.ensureAudioContext()

    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    // Pleasant ding sound - slower and more dramatic
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(700, this.audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(500, this.audioContext.currentTime + 0.4)

    gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.4)

    oscillator.start(this.audioContext.currentTime)
    oscillator.stop(this.audioContext.currentTime + 0.2)
  }

  // Generate win sound (victory fanfare)
  playWinSound() {
    if (!this.enabled || !this.audioContext) return

    this.ensureAudioContext()

    // Play multiple tones for fanfare
    const tones = [523.25, 659.25, 783.99] // C, E, G major chord

    tones.forEach((freq, index) => {
      const oscillator = this.audioContext.createOscillator()
      const gainNode = this.audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(this.audioContext.destination)

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime)

      gainNode.gain.setValueAtTime(0.0001, this.audioContext.currentTime)
      gainNode.gain.linearRampToValueAtTime(0.12, this.audioContext.currentTime + 0.15 + index * 0.15)
      gainNode.gain.linearRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.8 + index * 0.15)

      oscillator.start(this.audioContext.currentTime + index * 0.15)
      oscillator.stop(this.audioContext.currentTime + 0.8 + index * 0.15)
    })
  }

  // Generate lose sound (soft sad tone)
  playLoseSound() {
    if (!this.enabled || !this.audioContext) return

    this.ensureAudioContext()

    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    // Soft descending tone - slower and more gentle
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(380, this.audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(280, this.audioContext.currentTime + 0.5)

    gainNode.gain.setValueAtTime(0.08, this.audioContext.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.5)

    oscillator.start(this.audioContext.currentTime)
    oscillator.stop(this.audioContext.currentTime + 0.5)
  }

  // Generate button click sound
  playClick() {
    if (!this.enabled || !this.audioContext) return

    this.ensureAudioContext()

    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime)

    gainNode.gain.setValueAtTime(0.05, this.audioContext.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.05)

    oscillator.start(this.audioContext.currentTime)
    oscillator.stop(this.audioContext.currentTime + 0.05)
  }

  // Loop coin spin sound
  startCoinSpinLoop() {
    if (!this.enabled || !this.audioContext) return null

    this.ensureAudioContext()

    const interval = setInterval(() => {
      this.playCoinSpin()
    }, 250) // Play every 250ms for smoother, slower sound

    return interval
  }

  stopCoinSpinLoop(interval) {
    if (interval) {
      clearInterval(interval)
    }
  }

  // ========== LUCKY NUMBER GAME SOUNDS ==========

  // Generate number spin sound (mystical/magical spinning)
  playNumberSpin() {
    if (!this.enabled || !this.audioContext) return

    this.ensureAudioContext()

    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    // Mystical spinning sound - higher pitch, more magical
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(250, this.audioContext.currentTime + 0.18)

    gainNode.gain.setValueAtTime(0.06, this.audioContext.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.015, this.audioContext.currentTime + 0.18)

    oscillator.start(this.audioContext.currentTime)
    oscillator.stop(this.audioContext.currentTime + 0.18)
  }

  // Generate number reveal sound (magical reveal)
  playNumberReveal() {
    if (!this.enabled || !this.audioContext) return

    this.ensureAudioContext()

    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    // Magical reveal sound - ascending then descending
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime)
    oscillator.frequency.linearRampToValueAtTime(600, this.audioContext.currentTime + 0.2)
    oscillator.frequency.exponentialRampToValueAtTime(450, this.audioContext.currentTime + 0.5)

    gainNode.gain.setValueAtTime(0.12, this.audioContext.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.18, this.audioContext.currentTime + 0.2)
    gainNode.gain.linearRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.5)

    oscillator.start(this.audioContext.currentTime)
    oscillator.stop(this.audioContext.currentTime + 0.5)
  }

  // Generate number select sound (soft click)
  playNumberSelect() {
    if (!this.enabled || !this.audioContext) return

    this.ensureAudioContext()

    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    // Soft, pleasant click for number selection
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(500, this.audioContext.currentTime + 0.08)

    gainNode.gain.setValueAtTime(0.04, this.audioContext.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.08)

    oscillator.start(this.audioContext.currentTime)
    oscillator.stop(this.audioContext.currentTime + 0.08)
  }

  // Loop number spin sound
  startNumberSpinLoop() {
    if (!this.enabled || !this.audioContext) return null

    this.ensureAudioContext()

    const interval = setInterval(() => {
      this.playNumberSpin()
    }, 180) // Play every 180ms for faster, more exciting sound

    return interval
  }

  stopNumberSpinLoop(interval) {
    if (interval) {
      clearInterval(interval)
    }
  }
}

// Singleton instance
const soundManager = new SoundManager()

export default soundManager

