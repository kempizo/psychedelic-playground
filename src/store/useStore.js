import { create } from 'zustand'
import { loadPresets, savePresets, createPreset, mutatePreset } from '../utils/presetUtils'

const useStore = create((set, get) => ({
  // Audio data — written directly via getState() to skip re-renders
  audioData: { sub: 0, bass: 0, mid: 0, hi: 0 },

  // UI controls
  speed: 0.4,
  intensity: 0.7,
  colorShift: 0.0,
  chaos: 0.5,
  mode: 0,

  // Audio source state
  audioSource: null,   // 'mic' | 'file' | null
  isPlaying: false,

  // Preset system — loaded from localStorage on init
  presets: loadPresets(),
  activePresetId: null,

  setAudioData: (data) => set({ audioData: data }),
  setControl: (key, value) => set({ [key]: value }),
  setAudioSource: (source) => set({ audioSource: source }),
  setIsPlaying: (v) => set({ isPlaying: v }),

  savePreset: () => {
    const { speed, intensity, colorShift, chaos, mode } = get()
    const preset = createPreset({ speed, intensity, colorShift, chaos, mode })
    const presets = [...get().presets, preset]
    savePresets(presets)
    set({ presets, activePresetId: preset.id })
  },

  loadPreset: (id) => {
    const preset = get().presets.find(p => p.id === id)
    if (!preset) return
    set({ ...preset.params, activePresetId: id })
  },

  deletePreset: (id) => {
    const presets = get().presets.filter(p => p.id !== id)
    savePresets(presets)
    set({ presets, activePresetId: get().activePresetId === id ? null : get().activePresetId })
  },

  addPreset: (preset) => {
    const presets = [...get().presets, preset]
    savePresets(presets)
    set({ presets, activePresetId: preset.id })
  },

  mutateCurrent: () => {
    const state = get()
    const base = state.activePresetId
      ? state.presets.find(p => p.id === state.activePresetId)
      : createPreset({ speed: state.speed, intensity: state.intensity, colorShift: state.colorShift, chaos: state.chaos, mode: state.mode })
    if (!base) return
    const mutated = mutatePreset(base)
    const presets = [...state.presets, mutated]
    savePresets(presets)
    set({ presets, activePresetId: mutated.id, ...mutated.params })
  },
}))

export default useStore
