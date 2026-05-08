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

  // Update URL when controls change (debounced)
  useEffect(() => {
    if (!mounted.current) return
    const unsub = useStore.subscribe((state) => {
      const url = serialize(state)
      window.history.replaceState(null, '', url)
    })
    return unsub
  }, [])
}
