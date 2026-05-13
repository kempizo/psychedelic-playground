import { create } from 'zustand'
import { loadPresets, savePresets, createPreset, mutatePreset } from '../utils/presetUtils'

const DEFAULT_CONTROLS = {
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

const useStore = create((set, get) => ({
  // Audio data — written directly via getState() to skip re-renders
  audioData: {
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
  },

  // UI controls
  ...DEFAULT_CONTROLS,

  // Audio source state
  audioSource: null,   // 'mic' | 'file' | null
  isPlaying: false,

  // Energy system — promoted from BehavioralController each tick (≤30 Hz)
  energy: 0,
  behavioralState: 'calm',
  breakIntensity: 0,

  // Phase 6: gesture discoveries
  discoveries: [],

  // Phase 5: recording
  isRecording: false,

  // Preset system — loaded from localStorage on init
  presets: loadPresets(),
  activePresetId: null,

  setAudioData: (data) => set({ audioData: data }),
  setControl: (key, value) => set({ [key]: value }),
  resetControls: () => set({ ...DEFAULT_CONTROLS, activePresetId: null }),
  setAudioSource: (source) => set({ audioSource: source }),
  setIsPlaying: (v) => set({ isPlaying: v }),
  setEnergySnapshot: ({ energy, state, breakIntensity }) =>
    set({ energy, behavioralState: state, breakIntensity }),
  addDiscovery: (key) => set(s => ({
    discoveries: s.discoveries.includes(key) ? s.discoveries : [...s.discoveries, key]
  })),
  setIsRecording: (v) => set({ isRecording: v }),

  savePreset: () => {
    const { speed, intensity, colorShift, chaos, mode, trailDecay, cameraDistance, procIntensity, particleDensity } = get()
    const preset = createPreset({ speed, intensity, colorShift, chaos, mode, trailDecay, cameraDistance, procIntensity, particleDensity })
    const presets = [...get().presets, preset]
    savePresets(presets)
    set({ presets, activePresetId: preset.id })
  },

  loadPreset: (id) => {
    const preset = get().presets.find(p => p.id === id)
    if (!preset) return
    set({ ...DEFAULT_CONTROLS, ...preset.params, activePresetId: id })
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
      : createPreset({
          speed: state.speed,
          intensity: state.intensity,
          colorShift: state.colorShift,
          chaos: state.chaos,
          mode: state.mode,
          trailDecay: state.trailDecay,
          cameraDistance: state.cameraDistance,
          procIntensity: state.procIntensity,
          particleDensity: state.particleDensity,
        })
    if (!base) return
    const mutated = mutatePreset(base)
    const presets = [...state.presets, mutated]
    savePresets(presets)
    set({ presets, activePresetId: mutated.id, ...mutated.params })
  },
}))

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  window.__STORE__ = useStore
}

export default useStore
