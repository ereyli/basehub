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

    // Metallic spinning sound - softer and more pleasant
    oscillator.type = 'sine' // Changed from sawtooth to sine for softer sound
    oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(160, this.audioContext.currentTime + 0.25)

    gainNode.gain.setValueAtTime(0.05, this.audioContext.currentTime) // Reduced from 0.08
    gainNode.gain.linearRampToValueAtTime(0.015, this.audioContext.currentTime + 0.25)

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

    // Pleasant ding sound - softer and more pleasant
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(650, this.audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(480, this.audioContext.currentTime + 0.5)

    gainNode.gain.setValueAtTime(0.12, this.audioContext.currentTime) // Reduced from 0.15
    gainNode.gain.linearRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.5)

    oscillator.start(this.audioContext.currentTime)
    oscillator.stop(this.audioContext.currentTime + 0.5)
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
      gainNode.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.15 + index * 0.15) // Reduced from 0.12
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

    // Soft descending tone - even softer and more gentle
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(360, this.audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(270, this.audioContext.currentTime + 0.6)

    gainNode.gain.setValueAtTime(0.06, this.audioContext.currentTime) // Reduced from 0.08
    gainNode.gain.linearRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.6)

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
    oscillator.frequency.setValueAtTime(750, this.audioContext.currentTime) // Slightly lower pitch

    gainNode.gain.setValueAtTime(0.04, this.audioContext.currentTime) // Reduced from 0.05
    gainNode.gain.linearRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.06) // Slightly longer

    oscillator.start(this.audioContext.currentTime)
    oscillator.stop(this.audioContext.currentTime + 0.06)
  }

  // Loop coin spin sound
  startCoinSpinLoop() {
    if (!this.enabled || !this.audioContext) return null

    this.ensureAudioContext()

    const interval = setInterval(() => {
      this.playCoinSpin()
    }, 300) // Play every 300ms for even smoother, more pleasant sound

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

    // Mystical spinning sound - softer and more pleasant
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(320, this.audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(260, this.audioContext.currentTime + 0.22)

    gainNode.gain.setValueAtTime(0.05, this.audioContext.currentTime) // Reduced from 0.06
    gainNode.gain.linearRampToValueAtTime(0.012, this.audioContext.currentTime + 0.22)

    oscillator.start(this.audioContext.currentTime)
    oscillator.stop(this.audioContext.currentTime + 0.22)
  }

  // Generate number reveal sound (magical reveal)
  playNumberReveal() {
    if (!this.enabled || !this.audioContext) return

    this.ensureAudioContext()

    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    // Magical reveal sound - softer and more pleasant
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(380, this.audioContext.currentTime)
    oscillator.frequency.linearRampToValueAtTime(550, this.audioContext.currentTime + 0.25)
    oscillator.frequency.exponentialRampToValueAtTime(420, this.audioContext.currentTime + 0.6)

    gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime) // Reduced from 0.12
    gainNode.gain.linearRampToValueAtTime(0.15, this.audioContext.currentTime + 0.25) // Reduced from 0.18
    gainNode.gain.linearRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.6)

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
    oscillator.frequency.setValueAtTime(580, this.audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(480, this.audioContext.currentTime + 0.1)

    gainNode.gain.setValueAtTime(0.035, this.audioContext.currentTime) // Reduced from 0.04
    gainNode.gain.linearRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.1)

    oscillator.start(this.audioContext.currentTime)
    oscillator.stop(this.audioContext.currentTime + 0.08)
  }

  // Loop number spin sound
  startNumberSpinLoop() {
    if (!this.enabled || !this.audioContext) return null

    this.ensureAudioContext()

    const interval = setInterval(() => {
      this.playNumberSpin()
    }, 280) // Play every 280ms for smoother, more pleasant sound

    return interval
  }

  stopNumberSpinLoop(interval) {
    if (interval) {
      clearInterval(interval)
    }
  }

  // ========== DICE ROLL GAME SOUNDS ==========

  // Generate dice roll sound (wooden/metal rolling)
  playDiceRoll() {
    if (!this.enabled || !this.audioContext) return

    this.ensureAudioContext()

    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    // Wooden/metal rolling sound - softer and more pleasant
    oscillator.type = 'sine' // Changed from sawtooth to sine for much softer sound
    oscillator.frequency.setValueAtTime(140, this.audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(110, this.audioContext.currentTime + 0.2)

    gainNode.gain.setValueAtTime(0.06, this.audioContext.currentTime) // Reduced from 0.1
    gainNode.gain.linearRampToValueAtTime(0.02, this.audioContext.currentTime + 0.2) // Reduced from 0.03

    oscillator.start(this.audioContext.currentTime)
    oscillator.stop(this.audioContext.currentTime + 0.2)
  }

  // Generate dice reveal sound (impact/thud)
  playDiceReveal() {
    if (!this.enabled || !this.audioContext) return

    this.ensureAudioContext()

    // Create two oscillators for impact sound
    const osc1 = this.audioContext.createOscillator()
    const osc2 = this.audioContext.createOscillator()
    const gain1 = this.audioContext.createGain()
    const gain2 = this.audioContext.createGain()
    
    osc1.connect(gain1)
    osc2.connect(gain2)
    gain1.connect(this.audioContext.destination)
    gain2.connect(this.audioContext.destination)

    // Impact sound - softer and more pleasant
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(160, this.audioContext.currentTime)
    osc1.frequency.exponentialRampToValueAtTime(110, this.audioContext.currentTime + 0.4)

    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(210, this.audioContext.currentTime)
    osc2.frequency.exponentialRampToValueAtTime(130, this.audioContext.currentTime + 0.4)

    gain1.gain.setValueAtTime(0.09, this.audioContext.currentTime) // Reduced from 0.12
    gain1.gain.linearRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.4)

    gain2.gain.setValueAtTime(0.06, this.audioContext.currentTime) // Reduced from 0.08
    gain2.gain.linearRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.4)

    osc1.start(this.audioContext.currentTime)
    osc2.start(this.audioContext.currentTime)
    osc1.stop(this.audioContext.currentTime + 0.4)
    osc2.stop(this.audioContext.currentTime + 0.4)
  }

  // Generate dice select sound (soft click)
  playDiceSelect() {
    if (!this.enabled || !this.audioContext) return

    this.ensureAudioContext()

    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    // Soft, pleasant click for dice selection
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(480, this.audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(380, this.audioContext.currentTime + 0.1)

    gainNode.gain.setValueAtTime(0.035, this.audioContext.currentTime) // Reduced from 0.04
    gainNode.gain.linearRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.1)

    oscillator.start(this.audioContext.currentTime)
    oscillator.stop(this.audioContext.currentTime + 0.08)
  }

  // Loop dice roll sound
  startDiceRollLoop() {
    if (!this.enabled || !this.audioContext) return null

    this.ensureAudioContext()

    const interval = setInterval(() => {
      this.playDiceRoll()
    }, 320) // Play every 320ms for much smoother, more pleasant sound

    return interval
  }

  stopDiceRollLoop(interval) {
    if (interval) {
      clearInterval(interval)
    }
  }
}

// Singleton instance
const soundManager = new SoundManager()

export default soundManager

