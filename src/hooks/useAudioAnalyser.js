import { useEffect, useRef } from 'react'
import { getAnalyser } from '../audio/analyser'
import { extractBands } from '../audio/bands'
import useStore from '../store/useStore'

export function useAudioAnalyser() {
  const rafRef = useRef(null)
  const smoothed = useRef({
    sub: 0,
    bass: 0,
    mid: 0,
    hi: 0,
    energy: 0,
    energyEnvelope: 0,
    predictedEnergy: 0,
    onset: 0,
    beatPhase: 0,
    beatConfidence: 0,
    latencySec: 0,
    spectralCentroid: 0,
    spectralFlux: 0,
  })
  const beatState = useRef({
    lastTime: 0,
    lastEnergy: 0,
    lastOnsetTime: -999,
    beatInterval: 0.5,
    confidence: 0,
  })
  const scratchRef = useRef(null)
  const previousFftRef = useRef(null)

  useEffect(() => {
    const SILENCE_FLOOR = 0.006
    const SILENCE_GATE = 0.018

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
          previousFftRef.current = new Uint8Array(analyser.frequencyBinCount)
        }
        const data = scratchRef.current
        analyser.getByteFrequencyData(data)
        const raw = extractBands(data, previousFftRef.current)
        previousFftRef.current.set(data)
        const now = performance.now() / 1000
        const b = beatState.current
        if (b.lastTime === 0) b.lastTime = now
        const dt = Math.min(Math.max(now - b.lastTime, 1 / 120), 0.1)
        b.lastTime = now

        const s = smoothed.current
        s.sub  = ema(s.sub,  gateBand(raw.sub),  0.72, 0.16)
        s.bass = ema(s.bass, gateBand(raw.bass), 0.78, 0.18)
        s.mid  = ema(s.mid,  gateBand(raw.mid),  0.65, 0.16)
        s.hi   = ema(s.hi,   gateBand(raw.hi),   0.82, 0.22)
        s.spectralCentroid = ema(s.spectralCentroid, raw.spectralCentroid, 0.55, 0.08)
        s.spectralFlux     = ema(s.spectralFlux,     raw.spectralFlux,     0.78, 0.20)

        const energy = Math.min(1, s.sub * 0.16 + s.bass * 0.44 + s.mid * 0.28 + s.hi * 0.12)
        const attack = 1 - Math.exp(-dt / 0.025)
        const release = 1 - Math.exp(-dt / 0.42)
        s.energyEnvelope += (energy - s.energyEnvelope) * (energy > s.energyEnvelope ? attack : release)

        const onsetRaw = Math.max(0, energy - b.lastEnergy)
        const onset = Math.max(0, Math.min(1, onsetRaw * 6.5 + Math.max(0, s.bass - b.lastEnergy) * 2.0))
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
