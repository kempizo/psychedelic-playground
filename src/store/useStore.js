import { create } from 'zustand'

const useStore = create((set) => ({
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

  setAudioData: (data) => set({ audioData: data }),
  setControl: (key, value) => set({ [key]: value }),
  setAudioSource: (source) => set({ audioSource: source }),
  setIsPlaying: (v) => set({ isPlaying: v }),
}))

export default useStore
