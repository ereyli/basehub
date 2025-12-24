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

    // Metallic spinning sound
    oscillator.type = 'sawtooth'
    oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(150, this.audioContext.currentTime + 0.1)

    gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1)

    oscillator.start(this.audioContext.currentTime)
    oscillator.stop(this.audioContext.currentTime + 0.1)
  }

  // Generate result reveal sound (ding)
  playResultReveal() {
    if (!this.enabled || !this.audioContext) return

    this.ensureAudioContext()

    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    // Pleasant ding sound
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.2)

    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0, this.audioContext.currentTime + 0.2)

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

      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime)
      gainNode.gain.linearRampToValueAtTime(0.15, this.audioContext.currentTime + 0.1 + index * 0.1)
      gainNode.gain.exponentialRampToValueAtTime(0, this.audioContext.currentTime + 0.5 + index * 0.1)

      oscillator.start(this.audioContext.currentTime + index * 0.1)
      oscillator.stop(this.audioContext.currentTime + 0.5 + index * 0.1)
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

    // Soft descending tone
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(300, this.audioContext.currentTime + 0.3)

    gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0, this.audioContext.currentTime + 0.3)

    oscillator.start(this.audioContext.currentTime)
    oscillator.stop(this.audioContext.currentTime + 0.3)
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
    gainNode.gain.exponentialRampToValueAtTime(0, this.audioContext.currentTime + 0.05)

    oscillator.start(this.audioContext.currentTime)
    oscillator.stop(this.audioContext.currentTime + 0.05)
  }

  // Loop coin spin sound
  startCoinSpinLoop() {
    if (!this.enabled || !this.audioContext) return null

    this.ensureAudioContext()

    const interval = setInterval(() => {
      this.playCoinSpin()
    }, 100) // Play every 100ms for continuous sound

    return interval
  }

  stopCoinSpinLoop(interval) {
    if (interval) {
      clearInterval(interval)
    }
  }
}

// Singleton instance
const soundManager = new SoundManager()

export default soundManager

