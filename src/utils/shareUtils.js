const KEYS = ['speed', 'intensity', 'colorShift', 'chaos', 'mode']
const DEFAULTS = { speed: 0.4, intensity: 0.7, colorShift: 0.0, chaos: 0.5, mode: 0 }

export function serialize(state) {
  const params = new URLSearchParams()
  KEYS.forEach((k) => params.set(k, state[k]))
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`
}

export function deserialize(search) {
  const params = new URLSearchParams(search)
  const out = { ...DEFAULTS }
  KEYS.forEach((k) => {
    const v = params.get(k)
    if (v !== null) out[k] = k === 'mode' ? parseInt(v, 10) : parseFloat(v)
  })
  return out
}
