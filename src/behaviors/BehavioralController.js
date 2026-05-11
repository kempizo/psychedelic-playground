// State machine, energy tracking, parameter drift, color memory, break events,
// auto mode, and silence detection. Called synchronously from the render loop.

const STATE_TARGETS = {
  calm:      { speed: 0.30, chaos: 0.18, intensity: 0.38, trailDecay: 0.84 },
  build:     { speed: 0.58, chaos: 0.48, intensity: 0.62, trailDecay: 0.83 },
  peak:      { speed: 0.82, chaos: 0.78, intensity: 0.88, trailDecay: 0.81 },
  afterglow: { speed: 0.42, chaos: 0.38, intensity: 0.58, trailDecay: 0.86 },
}

export class BehavioralController {
  constructor() {
    this.state       = 'calm'
    this.prevState   = 'calm'
    this.stateTimer  = 0
    this.energy      = 0
    this.energyPrev  = 0
    this.energyDeriv = 0
    this.driftT      = 0
    this.colorPhase  = 0

    this.targets = { ...STATE_TARGETS.calm, colorShift: 0 }

    this.userIdleTimer  = 0
    this.autoTimer      = 0
    this.silenceTimer   = 0

    // Smooth state transitions over ~600ms
    this.stateBlend = 1.0
    this.prevTargets = { ...STATE_TARGETS.calm }

    this.breakEvent = { active: false, timer: 0, duration: 0, intensity: 0 }
    this.breakIntensity = 0

    // Slow drift LFOs — three relatively-prime periods so they never repeat together
    this.lfoT = 0  // accumulates real time for LFO phases

    // Formation event: structural mode bias triggered by sustained high energy
    this.highEnergyTimer = 0
    this.formation = { active: false, timer: 0, duration: 3.0, bias: 0 }
  }

  _updateEnergy(audioData, dt) {
    const {
      sub,
      bass,
      lowMid = 0,
      mid,
      highMid = 0,
      treble = 0,
      hi,
      rms = 0,
    } = audioData
    const high = Math.max(hi, highMid * 0.72 + treble * 0.45)
    const rawEnergy = rms * 0.18 + sub * 0.12 + bass * 0.36 + lowMid * 0.12 + mid * 0.16 + high * 0.06
    const alpha = 1 - Math.pow(0.98, dt * 60)
    this.energyPrev  = this.energy
    this.energy     += (rawEnergy - this.energy) * alpha
    this.energyDeriv = (this.energy - this.energyPrev) / Math.max(dt, 0.001)
  }

  _updateState(dt) {
    this.stateTimer += dt
    const { energy: e, energyDeriv: de } = this

    let next = this.state
    switch (this.state) {
      case 'calm':
        if (e > 0.28 && de > 0)                           next = 'build'; break
      case 'build':
        if (e > 0.68 || (e > 0.5 && de > 0.15))          next = 'peak'
        else if (e < 0.12 && this.stateTimer > 3)         next = 'calm'
        break
      case 'peak':
        if (de < -0.08 && this.stateTimer > 1.5)          next = 'afterglow'; break
      case 'afterglow':
        if (e > 0.65)                                      next = 'peak'
        else if (e < 0.18 && this.stateTimer > 4)         next = 'calm'
        break
    }

    if (next !== this.state) {
      this.prevState   = this.state
      this.prevTargets = { ...STATE_TARGETS[this.state] }
      this.state       = next
      this.stateTimer  = 0
      this.stateBlend  = 0
    }
  }

  _computeDrift() {
    const t = this.driftT
    // Fast micro-drift (existing): subtle per-frame variation
    const fast = {
      speed:     Math.sin(t * 0.031)         * 0.06,
      chaos:     Math.sin(t * 0.019 + 1.71)  * 0.05,
      intensity: Math.sin(t * 0.023 + 3.20)  * 0.04,
    }
    // Slow LFOs: 37s, 71s, 113s — relatively prime, never repeat the same pattern
    const lt = this.lfoT
    const lfo37  = Math.sin((lt / 37)  * Math.PI * 2)
    const lfo71  = Math.sin((lt / 71)  * Math.PI * 2 + 1.1)
    const lfo113 = Math.sin((lt / 113) * Math.PI * 2 + 2.7)
    return {
      speed:       fast.speed,
      intensity:   fast.intensity,
      chaos:       fast.chaos + lfo37  * 0.12,   // macro warp breathes over 37s
      paletteDrift: lfo71  * 0.15,                // hue bias wanders over 71s
      forceBias:   lfo113,                         // -1→1: pull vs push bias over 113s
    }
  }

  _breakModifier() {
    if (!this.breakEvent.active) return 0
    const p = this.breakEvent.timer / this.breakEvent.duration
    return p < 0.1
      ? (p / 0.1) * this.breakEvent.intensity
      : this.breakEvent.intensity * (1 - (p - 0.1) / 0.9)
  }

  injectEnergy(amount) {
    this.energy = Math.min(1.0, this.energy + amount)
  }

  _updateBreakEvent(dt) {
    // Decay breakIntensity each tick
    this.breakIntensity *= Math.pow(0.94, dt * 60)

    if (this.breakEvent.active) {
      this.breakEvent.timer += dt
      if (this.breakEvent.timer >= this.breakEvent.duration) {
        this.breakEvent.active = false
      }
    } else if (this.state !== 'peak') {
      if (Math.random() < 0.006 * dt) {
        this.breakEvent = {
          active: true,
          timer: 0,
          duration: 4 + Math.random() * 6,
          intensity: 0.4 + Math.random() * 0.5,
        }
        this.breakIntensity = 1.0
      }
    }
  }

  _updateFormation(dt) {
    if (this.energy > 0.7) {
      this.highEnergyTimer += dt
    } else {
      this.highEnergyTimer = Math.max(0, this.highEnergyTimer - dt * 2)
    }

    if (!this.formation.active && this.highEnergyTimer > 2.0 && Math.random() < 0.008 * dt) {
      this.formation = { active: true, timer: 0, duration: 3.0 + Math.random() * 2.0, bias: 0 }
      this.highEnergyTimer = 0
    }

    if (this.formation.active) {
      this.formation.timer += dt
      const p = this.formation.timer / this.formation.duration
      // Ramp in over 15%, hold, ramp out over last 20%
      this.formation.bias = p < 0.15
        ? p / 0.15
        : p > 0.80
          ? 1.0 - (p - 0.80) / 0.20
          : 1.0
      if (this.formation.timer >= this.formation.duration) {
        this.formation.active = false
        this.formation.bias = 0
      }
    }
  }

  _maybeVirtualPulse() {
    const interval = 8 + (1 - Math.min(this.energy * 1.2, 1)) * 15
    if (this.autoTimer >= interval) {
      this.autoTimer = Math.random() * 3
      const angle = Math.random() * Math.PI * 2
      const r     = 0.2 + Math.random() * 0.6
      return {
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
        energy: 0.45 + this.energy * 0.45,
        speed: 0.45 + this.energy * 0.35,
        type: 'bass',
      }
    }
    return null
  }

  tick(audioData, dt, userControls) {
    this._updateEnergy(audioData, dt)

    const isSilence = audioData.silence > 0.65 ||
      audioData.sub + audioData.bass + (audioData.lowMid ?? 0) + audioData.mid + audioData.hi < 0.015
    if (isSilence) {
      this.silenceTimer += dt
    } else {
      this.silenceTimer = 0
    }

    if (this.silenceTimer > 2) {
      this.state      = 'calm'
      this.stateTimer = 0
      this.userIdleTimer = Math.max(this.userIdleTimer, 8)
    } else {
      this._updateState(dt)
    }

    this.driftT    += dt
    this.lfoT      += dt
    this.colorPhase = (this.colorPhase + dt * 0.002) % 1.0

    this._updateBreakEvent(dt)
    this._updateFormation(dt)
    this.userIdleTimer += dt
    this.autoTimer     += dt

    // Ramp stateBlend to 1 over ~600ms for smooth state cross-fades
    this.stateBlend = Math.min(1.0, this.stateBlend + dt / 0.6)
    const newTgt    = STATE_TARGETS[this.state]
    const prevTgt   = this.prevTargets
    const blendedTgt = {
      speed:      prevTgt.speed      + (newTgt.speed      - prevTgt.speed)      * this.stateBlend,
      chaos:      prevTgt.chaos      + (newTgt.chaos      - prevTgt.chaos)      * this.stateBlend,
      intensity:  prevTgt.intensity  + (newTgt.intensity  - prevTgt.intensity)  * this.stateBlend,
      trailDecay: prevTgt.trailDecay + (newTgt.trailDecay - prevTgt.trailDecay) * this.stateBlend,
    }
    const drift = this._computeDrift()

    const lerpRate = 0.012
    this.targets.speed     += (blendedTgt.speed     + drift.speed     - this.targets.speed)     * lerpRate
    this.targets.chaos     += (blendedTgt.chaos     + drift.chaos     - this.targets.chaos)     * lerpRate
    this.targets.intensity += (blendedTgt.intensity + drift.intensity - this.targets.intensity) * lerpRate
    this.targets.trailDecay = blendedTgt.trailDecay
    this.targets.colorShift += (this.colorPhase     - this.targets.colorShift) * 0.005

    const autoBlend = Math.min(this.userIdleTimer / 8.0, 1.0)

    const blend = (user, auto) => user * (1 - autoBlend) + auto * autoBlend

    const virtualPulse = autoBlend > 0.5 ? this._maybeVirtualPulse() : null

    return {
      speed:          blend(userControls.speed,      this.targets.speed),
      chaos:          blend(userControls.chaos,      this.targets.chaos),
      intensity:      blend(userControls.intensity,  this.targets.intensity),
      colorShift:     blend(userControls.colorShift, this.targets.colorShift),
      trailDecay:     this.targets.trailDecay,
      state:          this.state,
      autoBlend,
      isSilence:      this.silenceTimer > 2,
      breakIntensity: this.breakIntensity,
      virtualPulse,
      paletteDrift:   drift.paletteDrift  ?? 0,
      forceBias:      drift.forceBias     ?? 0,
      formationBias:  this.formation.bias,
    }
  }
}
