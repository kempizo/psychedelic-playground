export const STORAGE_KEY = 'psychedelic_presets'

const ADJS  = ['Acid', 'Teal', 'Void', 'Deep', 'Flux', 'Cyan', 'Neon', 'Dark', 'Wild', 'Pure']
const NOUNS = ['Drift', 'Surge', 'Pulse', 'Field', 'Bloom', 'Wave', 'Storm', 'Flow', 'Dream', 'Core']

function autoName(id) {
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return `${ADJS[hash % ADJS.length]} ${NOUNS[(hash * 7) % NOUNS.length]}`
}

export function loadPresets() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? []
  } catch {
    return []
  }
}

export function savePresets(presets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
}

export function createPreset(params) {
  const id = crypto.randomUUID()
  return { id, name: autoName(id), params: { ...params }, createdAt: Date.now() }
}

const RANGES = {
  speed:      { min: 0.1, max: 1.0 },
  intensity:  { min: 0.1, max: 1.0 },
  colorShift: { min: 0.0, max: 1.0 },
  chaos:      { min: 0.0, max: 1.0 },
}

export function mutatePreset(preset) {
  const p = { ...preset.params }
  for (const [key, { min, max }] of Object.entries(RANGES)) {
    const span = max - min
    p[key] = Math.min(max, Math.max(min, p[key] + (Math.random() * 2 - 1) * span * 0.25))
  }
  return createPreset(p)
}

export function encodePreset(params) {
  return btoa(JSON.stringify(params))
}

export function decodePreset(str) {
  try {
    const parsed = JSON.parse(atob(str))
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}
