import { useEffect, useRef } from 'react'
import { getAnalyser } from '../audio/analyser'
import { extractBands } from '../audio/bands'
import useStore from '../store/useStore'

export function useAudioAnalyser() {
  const rafRef = useRef(null)
  const smoothed = useRef({ sub: 0, bass: 0, mid: 0, hi: 0 })

  useEffect(() => {
    // Fast attack, slow release — captures transients without jitter
    function ema(prev, next, aAtk, aRel) {
      return next > prev
        ? prev + (next - prev) * aAtk
        : prev + (next - prev) * aRel
    }

    const loop = () => {
      const analyser = getAnalyser()
      if (analyser) {
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        const raw = extractBands(data)

        const s = smoothed.current
        s.sub  = ema(s.sub,  raw.sub,  0.55, 0.90)
        s.bass = ema(s.bass, raw.bass, 0.60, 0.88)
        s.mid  = ema(s.mid,  raw.mid,  0.55, 0.85)
        s.hi   = ema(s.hi,   raw.hi,   0.65, 0.80)

        // Write directly — bypasses React re-render
        useStore.getState().setAudioData({ ...s })
      }
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])
}
