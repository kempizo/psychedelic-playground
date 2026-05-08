import { useEffect, useRef } from 'react'
import useStore from '../store/useStore'
import { deserialize, serialize } from '../utils/shareUtils'

export function useURLState() {
  const mounted = useRef(false)

  // Hydrate from URL on mount
  useEffect(() => {
    if (window.location.search) {
      const state = deserialize(window.location.search)
      const { setControl } = useStore.getState()
      Object.entries(state).forEach(([k, v]) => setControl(k, v))
    }
    mounted.current = true
  }, [])

  // Update URL when controls change — skip if nothing serializable changed.
  // Without this guard, audio data updates (60fps) would hit the browser's
  // replaceState rate limit (100 calls / 10s) and throw a SecurityError.
  useEffect(() => {
    if (!mounted.current) return
    let lastUrl = ''
    const unsub = useStore.subscribe((state) => {
      const url = serialize(state)
      if (url !== lastUrl) {
        lastUrl = url
        window.history.replaceState(null, '', url)
      }
    })
    return unsub
  }, [])
}
