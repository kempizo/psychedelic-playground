import { encodePreset, decodePreset } from './presetUtils'

const KEYS = ['speed', 'intensity', 'colorShift', 'chaos', 'mode', 'trailDecay', 'cameraDistance', 'procIntensity', 'particleDensity']
const DEFAULTS = {
  speed: 0.4,
  intensity: 0.7,
  colorShift: 0.0,
  chaos: 0.5,
  mode: 0,
  trailDecay: 0.84,
  cameraDistance: 0,
  procIntensity: 0.45,
  particleDensity: 1,
}
const RANGES = {
  speed: [0.05, 1.5],
  intensity: [0, 1.5],
  colorShift: [0, 1],
  chaos: [0, 1],
  mode: [0, 4],
  trailDecay: [0.70, 0.94],
  cameraDistance: [-0.7, 0.9],
  procIntensity: [0, 1],
  particleDensity: [0, 2],
}

function clampParam(key, value) {
  const [min, max] = RANGES[key]
  return Math.max(min, Math.min(max, value))
}

export function serialize(state) {
  const params = new URLSearchParams()
  KEYS.forEach((k) => params.set(k, state[k]))
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`
}

export function serializeWithPreset(state, preset) {
  const url = new URL(serialize(state))
  url.searchParams.set('preset', encodePreset(preset.params))
  return url.toString()
}

export function deserialize(search) {
  const params = new URLSearchParams(search)
  const out = { ...DEFAULTS }
  KEYS.forEach((k) => {
    const v = params.get(k)
    if (v !== null) {
      const parsed = k === 'mode' ? parseInt(v, 10) : parseFloat(v)
      if (Number.isFinite(parsed)) out[k] = clampParam(k, parsed)
    }
  })
  return out
}

export function extractSharedPreset(search) {
  const str = new URLSearchParams(search).get('preset')
  return str ? decodePreset(str) : null
}
