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

    this.breakEvent = { active: false, timer: 0, duration: 0, intensity: 0 }
  }

  _updateEnergy(audioData, dt) {
    const { sub, bass, mid, hi } = audioData
    const rawEnergy = sub * 0.15 + bass * 0.45 + mid * 0.28 + hi * 0.12
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
      this.state      = next
      this.stateTimer = 0
    }
  }

  _computeDrift() {
    const t = this.driftT
    return {
      speed:     Math.sin(t * 0.031)          * 0.06,
      chaos:     Math.sin(t * 0.019 + 1.71)  * 0.05,
      intensity: Math.sin(t * 0.023 + 3.20)  * 0.04,
    }
  }

  _breakModifier() {
    if (!this.breakEvent.active) return 0
    const p = this.breakEvent.timer / this.breakEvent.duration
    return p < 0.1
      ? (p / 0.1) * this.breakEvent.intensity
      : this.breakEvent.intensity * (1 - (p - 0.1) / 0.9)
  }

  _updateBreakEvent(dt) {
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

    const isSilence = audioData.sub + audioData.bass + audioData.mid + audioData.hi < 0.015
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
    this.colorPhase = (this.colorPhase + dt * 0.002) % 1.0

    this._updateBreakEvent(dt)
    this.userIdleTimer += dt
    this.autoTimer     += dt

    const stateTgt = STATE_TARGETS[this.state]
    const drift    = this._computeDrift()

    const lerp = 0.012
    this.targets.speed     += (stateTgt.speed     + drift.speed     - this.targets.speed)     * lerp
    this.targets.chaos     += (stateTgt.chaos     + drift.chaos     - this.targets.chaos)     * lerp
    this.targets.intensity += (stateTgt.intensity + drift.intensity - this.targets.intensity) * lerp
    this.targets.trailDecay = stateTgt.trailDecay
    this.targets.colorShift += (this.colorPhase   - this.targets.colorShift) * 0.005

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
      breakIntensity: this._breakModifier(),
      virtualPulse,
    }
  }
}
