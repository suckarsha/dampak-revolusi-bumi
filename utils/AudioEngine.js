class AudioEngine {
  constructor() {
    this.ctx = null;
    this.droneOscillators = [];
    this.droneGain = null;
    this.isMuted = true;
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.isInitialized = true;
      this.createDrone();
    } catch (e) {
      console.error("Audio API not supported");
    }
  }

  createDrone() {
    if (!this.ctx) return;
    
    // Master gain for drone (overall volume)
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0; // Starts muted
    this.droneGain.connect(this.ctx.destination);

    // Deep space low hum (sine wave at 55Hz)
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 55;
    osc1.connect(this.droneGain);
    osc1.start();
    this.droneOscillators.push(osc1);

    // Slightly detuned hum for phasing effect
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 54.5;
    
    // Low pass filter to make it sound muffled and far away
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 150;
    
    osc2.connect(filter);
    filter.connect(this.droneGain);
    osc2.start();
    this.droneOscillators.push(osc2);
  }

  playClick() {
    if (!this.ctx || this.isMuted) return;
    
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    // Futuristic sci-fi UI click sound
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.1);
    
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(t);
    osc.stop(t + 0.1);
  }

  toggleMute() {
    if (!this.isInitialized) {
      this.init();
    }
    
    if (!this.ctx) return false;
    
    // Browser auto-suspends AudioContext until user interaction
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    this.isMuted = !this.isMuted;
    
    if (this.droneGain) {
      // Fade volume gently
      this.droneGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.25, this.ctx.currentTime, 0.5);
    }
    
    // Play a click when turning on
    if (!this.isMuted) {
      this.playClick();
    }
    
    return !this.isMuted;
  }
}

// Export singleton
export const audioSystem = typeof window !== 'undefined' ? new AudioEngine() : null;
