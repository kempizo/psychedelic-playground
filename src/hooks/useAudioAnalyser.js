import { useEffect, useRef } from 'react'
import { getAnalyser } from '../audio/analyser'
import { extractBands } from '../audio/bands'
import useStore from '../store/useStore'

export function useAudioAnalyser() {
  const rafRef = useRef(null)
  const smoothed = useRef({ sub: 0, bass: 0, mid: 0, hi: 0 })

  useEffect(() => {
    const loop = () => {
      const analyser = getAnalyser()
      if (analyser) {
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        const raw = extractBands(data)

        // Exponential smoothing per band
        const s = smoothed.current
        s.sub  = s.sub  * 0.82 + raw.sub  * 0.18
        s.bass = s.bass * 0.78 + raw.bass * 0.22
        s.mid  = s.mid  * 0.80 + raw.mid  * 0.20
        s.hi   = s.hi   * 0.75 + raw.hi   * 0.25

        // Write directly — bypasses React re-render
        useStore.getState().setAudioData({ ...s })
      }
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])
}
