import { useEffect, useRef } from 'react'
import { getAnalyser } from '../audio/analyser'
import { extractBands } from '../audio/bands'
import useStore from '../store/useStore'

export function useAudioAnalyser() {
  const rafRef = useRef(null)
  const smoothed = useRef({
    sub: 0,
    bass: 0,
    lowMid: 0,
    mid: 0,
    highMid: 0,
    treble: 0,
    hi: 0,
    rms: 0,
    energy: 0,
    energyEnvelope: 0,
    predictedEnergy: 0,
    onset: 0,
    bassPulse: 0,
    midPulse: 0,
    treblePulse: 0,
    beatPhase: 0,
    beatConfidence: 0,
    latencySec: 0,
    spectralCentroid: 0,
    spectralFlux: 0,
    silence: 1,
  })
  const beatState = useRef({
    lastTime: 0,
    lastEnergy: 0,
    lastOnsetTime: -999,
    beatInterval: 0.5,
    confidence: 0,
  })
  const adaptive = useRef({
    bass: 0.05,
    mid: 0.05,
    treble: 0.05,
  })
  const silenceState = useRef({
    quietTime: 0,
    liveTime: 0,
    isSilent: true,
  })
  const scratchRef = useRef(null)
  const waveformRef = useRef(null)
  const previousFftRef = useRef(null)

  useEffect(() => {
    const SILENCE_FLOOR = 0.006
    const SILENCE_GATE = 0.018
    const SILENCE_ENTER_ENERGY = 0.016
    const SILENCE_EXIT_ENERGY = 0.030
    const SILENCE_ENTER_TIME = 0.22
    const SILENCE_EXIT_TIME = 0.05

    // Fast attack, measured release — captures transients without silence jitter.
    function ema(prev, next, aAtk, aRel) {
      return next > prev
        ? prev + (next - prev) * aAtk
        : prev + (next - prev) * aRel
    }

    function gateBand(v) {
      if (v < SILENCE_FLOOR) return 0
      if (v < SILENCE_GATE) return (v - SILENCE_FLOOR) / (SILENCE_GATE - SILENCE_FLOOR) * v
      return v
    }

    const loop = () => {
      const analyser = getAnalyser()
      if (analyser) {
        if (!scratchRef.current || scratchRef.current.length !== analyser.frequencyBinCount) {
          scratchRef.current = new Uint8Array(analyser.frequencyBinCount)
          waveformRef.current = new Uint8Array(analyser.fftSize)
          previousFftRef.current = new Uint8Array(analyser.frequencyBinCount)
        }
        const data = scratchRef.current
        const waveform = waveformRef.current
        analyser.getByteFrequencyData(data)
        analyser.getByteTimeDomainData(waveform)
        const raw = extractBands(data, previousFftRef.current, {
          sampleRate: analyser.context.sampleRate,
          fftSize: analyser.fftSize,
          waveform,
        })
        previousFftRef.current.set(data)
        const now = performance.now() / 1000
        const b = beatState.current
        if (b.lastTime === 0) b.lastTime = now
        const dt = Math.min(Math.max(now - b.lastTime, 1 / 120), 0.1)
        b.lastTime = now

        const s = smoothed.current
        s.sub  = ema(s.sub,  gateBand(raw.sub),  0.72, 0.16)
        s.bass = ema(s.bass, gateBand(raw.bass), 0.78, 0.18)
        s.lowMid = ema(s.lowMid, gateBand(raw.lowMid), 0.66, 0.16)
        s.mid  = ema(s.mid,  gateBand(raw.mid),  0.65, 0.16)
        s.highMid = ema(s.highMid, gateBand(raw.highMid), 0.72, 0.18)
        s.treble = ema(s.treble, gateBand(raw.treble), 0.86, 0.24)
        s.hi   = ema(s.hi,   gateBand(raw.hi),   0.82, 0.22)
        s.rms  = ema(s.rms,  gateBand(raw.rms),  0.58, 0.16)
        s.spectralCentroid = ema(s.spectralCentroid, raw.spectralCentroid, 0.55, 0.08)
        s.spectralFlux     = ema(s.spectralFlux,     raw.spectralFlux,     0.78, 0.20)

        const a = adaptive.current
        const adaptRate = 1 - Math.exp(-dt / 3.5)
        a.bass += (Math.max(0.025, s.bass) - a.bass) * adaptRate
        a.mid += (Math.max(0.025, s.lowMid * 0.45 + s.mid * 0.55) - a.mid) * adaptRate
        a.treble += (Math.max(0.025, s.highMid * 0.45 + s.treble * 0.55) - a.treble) * adaptRate

        const energy = Math.min(1,
          s.rms * 0.20 +
          s.sub * 0.12 +
          s.bass * 0.34 +
          s.lowMid * 0.12 +
          s.mid * 0.16 +
          s.highMid * 0.04 +
          s.treble * 0.02
        )
        const silence = silenceState.current
        const quietCandidate = raw.silence && energy < SILENCE_ENTER_ENERGY && s.rms < 0.014
        const liveCandidate = energy > SILENCE_EXIT_ENERGY || s.rms > 0.022
        silence.quietTime = quietCandidate
          ? silence.quietTime + dt
          : Math.max(0, silence.quietTime - dt * 1.5)
        silence.liveTime = liveCandidate
          ? silence.liveTime + dt
          : Math.max(0, silence.liveTime - dt * 2.0)
        if (!silence.isSilent && silence.quietTime > SILENCE_ENTER_TIME) {
          silence.isSilent = true
          silence.liveTime = 0
        } else if (silence.isSilent && silence.liveTime > SILENCE_EXIT_TIME) {
          silence.isSilent = false
          silence.quietTime = 0
        }

        const silenceTarget = silence.isSilent ? 1 : 0
        s.silence = ema(s.silence, silenceTarget, 0.20, 0.48)
        const quietDamp = energy < 0.024
          ? 1 - Math.min(0.92, s.silence * 0.92)
          : 1

        const attack = 1 - Math.exp(-dt / 0.025)
        const release = 1 - Math.exp(-dt / 0.42)
        s.energyEnvelope += (energy - s.energyEnvelope) * (energy > s.energyEnvelope ? attack : release)

        const bassPulseRaw = Math.max(0, (s.bass - a.bass * 1.16) / Math.max(a.bass, 0.025))
        const midPulseRaw = Math.max(0, ((s.lowMid * 0.4 + s.mid * 0.6) - a.mid * 1.12) / Math.max(a.mid, 0.025))
        const treblePulseRaw = Math.max(0, ((s.highMid * 0.45 + s.treble * 0.55) - a.treble * 1.10) / Math.max(a.treble, 0.025))
        s.bassPulse = ema(s.bassPulse, Math.min(1, bassPulseRaw * 0.65) * quietDamp, 0.86, 0.18)
        s.midPulse = ema(s.midPulse, Math.min(1, midPulseRaw * 0.55) * quietDamp, 0.78, 0.18)
        s.treblePulse = ema(s.treblePulse, Math.min(1, treblePulseRaw * 0.45) * quietDamp, 0.90, 0.25)

        const onsetRaw = Math.max(0, energy - b.lastEnergy)
        const onset = Math.max(0, Math.min(1,
          onsetRaw * 5.4 +
          s.spectralFlux * 0.55 +
          s.bassPulse * 0.35 +
          s.treblePulse * 0.18
        )) * quietDamp
        s.onset = ema(s.onset, onset, 0.75, 0.22)

        const minBeatGap = 0.24
        const maxBeatGap = 1.2
        if (s.onset > 0.18 && energy > 0.08 && now - b.lastOnsetTime > minBeatGap) {
          const interval = now - b.lastOnsetTime
          if (interval > minBeatGap && interval < maxBeatGap) {
            b.beatInterval += (interval - b.beatInterval) * 0.18
            b.confidence = Math.min(1, b.confidence + 0.18)
          } else {
            b.confidence = Math.max(0, b.confidence - 0.08)
          }
          b.lastOnsetTime = now
        } else {
          b.confidence = Math.max(0, b.confidence - dt * 0.12)
        }

        const ctx = analyser.context
        const outputLatency = ctx.outputLatency || 0
        const baseLatency = ctx.baseLatency || 0
        const fftLatency = analyser.fftSize / Math.max(ctx.sampleRate || 44100, 1)
        s.latencySec = Math.min(0.18, outputLatency + baseLatency + fftLatency * 0.5)

        const predicted = s.energyEnvelope + Math.max(0, energy - b.lastEnergy) * Math.min(5.0, s.latencySec * 34.0)
        s.predictedEnergy = Math.min(1, predicted)
        s.beatPhase = b.lastOnsetTime > -900
          ? ((now + s.latencySec - b.lastOnsetTime) / Math.max(b.beatInterval, minBeatGap)) % 1
          : 0
        s.beatConfidence = b.confidence
        s.energy = energy
        s.spectralFlux *= quietDamp
        b.lastEnergy = energy

        // Write directly — bypasses React re-render
        useStore.getState().setAudioData({ ...s })
      }
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])
}
