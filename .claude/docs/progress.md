# Psychedelic Playground — Project Progress

## Status: Core bugs resolved, audio playback working, pause button pending

---

## Done

### Infrastructure
- [x] Vite + React 19 + Three.js + Zustand project scaffold
- [x] Tailwind CSS 3 with full-screen dark layout
- [x] `src/` folder structure: `audio/`, `components/`, `hooks/`, `shaders/`, `store/`, `three/`, `utils/`
- [x] Git repository initialized
- [x] `.claude/` project config: CLAUDE.md, rules, agents, skills, settings.json

### Visual Engine
- [x] Full-screen WebGL canvas via Three.js `OrthographicCamera` + `PlaneGeometry(2,2)`
- [x] `psychedelic.frag`: FBM domain warping (6 octaves, 2-layer IQ technique), cosine palette (teal/green/violet), vignette
- [x] 3-pass render pipeline: main shader → trail blend (ping-pong) → screen composite
- [x] Trail/echo effect (decay 0.82) via two `WebGLRenderTarget`s swapped each frame
- [x] CPU particle system (128 max), treble-triggered spawn, additive blending
- [x] **Bug fixed**: `psychedelic.vert` was missing `precision highp float;` and attribute declarations — caused silent shader compile failure (black canvas)

### Audio
- [x] Web Audio API singleton `AudioContext`
- [x] Mic input with Safari-safe `context.resume()` inside click handler
- [x] File drag-and-drop audio input
- [x] FFT analysis → 4 frequency bands: sub (0–86Hz), bass (86–430Hz), mid (430–2150Hz), hi (2150–8600Hz)
- [x] Exponential smoothing per band (attack/release)
- [x] 60fps writes to Zustand store via `getState()` — no React re-renders

### Controls & UI
- [x] Landing screen with animated overlay, `AudioInput` selector
- [x] Control panel: Speed, Intensity, Color Shift, Chaos, Mode sliders
- [x] Zustand store with `setControl`, `setAudioData`, `setAudioSource`, `setIsPlaying`
- [x] URL save/share: 5 controls serialized to query params via `history.replaceState`
- [x] Share button copies URL to clipboard
- [x] "Change source" button in ControlPanel to switch between mic and file without page reload

### Bug Fixes (session 2)
- [x] **StrictMode removed** — React StrictMode double-invokes `useEffect` in dev, destroying the WebGL context on cleanup; canvas can only hold one context per lifetime
- [x] **WebGL feedback loop resolved** — Added third independent `WebGLRenderTarget` (rtC); trailRead/trailWrite now ping-pong between rtB and rtC so Pass 2 never reads and writes the same texture simultaneously; texture uniforms explicitly nulled between passes to prevent Three.js binding cache from carrying stale references
- [x] **`history.replaceState` rate limit fixed** — Added `lastUrl` cache in `useURLState`; `replaceState` only fires when serialized URL actually changes, not on every 60fps audio store update
- [x] **File audio silent playback fixed** — `connectSource()` in `analyser.js` was only routing to the `AnalyserNode`; added optional `toSpeakers` flag that also connects to `ctx.destination`; file audio passes `true`, mic does not (prevents feedback)

---

## What's Next

### High Priority
- [ ] **Pause/resume button** — needed on both the mic and upload audio interfaces; mic should mute analysis (not stop stream), file audio should pause/resume `AudioBufferSourceNode` playback and also pause the visual loop
- [ ] **Cross-browser test** — Safari requires `audioContext.resume()` inside a click; test mic + file on Safari 17+
- [ ] **Mobile check** — reduce `fftSize` to 1024 on small screens, verify touch controls work
- [ ] **Error states** — mic permission denied banner, file format unsupported warning

### Visual Polish
- [ ] **Mode 1 (Radial) tuning** — the polar mode is functional but visually weaker than Mode 0; FBM parameters could be tweaked specifically for it
- [ ] **Idle animation without audio** — currently the shader animates slowly with no audio (good), but color palette feels flat; consider a gentle automatic color drift
- [ ] **Particle color variety** — currently teal/green only; could tint towards violet at low velocity

### Architecture
- [ ] **Bundle size** — Three.js is 913KB minified; consider tree-shaking unused Three.js modules (no OrbitControls, no loaders, etc.)
- [ ] **Performance validation** — measure actual FPS on mid-range hardware; if below 55fps, consider reducing FBM octaves from 6 → 5 or dropping trail pass resolution

### Future Ideas (post-MVP)
- [ ] Beat detection → camera pulse/flash on kick
- [ ] Preset system (save named configurations)
- [ ] MIDI controller support via Web MIDI API
- [ ] Export a GIF/video clip of a session
- [ ] PWA manifest so it can be installed as a desktop app

---

## Known Issues

| Issue | Status | Notes |
|-------|--------|-------|
| Vertex shader missing attribute declarations | Fixed | `psychedelic.vert` now declares `attribute vec3 position; attribute vec2 uv;` |
| `dt` double-getDelta bug | Fixed | Particle age update uses hardcoded `1/60` |
| Particle x-position out of camera bounds | Fixed | Removed aspect multiplier from spawn position |
| WebGL feedback loop (read+write same texture) | Fixed | Third independent `WebGLRenderTarget` (rtC) added; ping-pong between rtB/rtC |
| `history.replaceState` SecurityError (>100 calls/10s) | Fixed | `lastUrl` cache prevents calling `replaceState` on 60fps audio updates |
| File audio silent (no speaker output) | Fixed | `connectSource(source, true)` now also connects to `ctx.destination` |
| React StrictMode double WebGL context destruction | Fixed | Removed `<StrictMode>` from `main.jsx` |

---

## Architecture Quick Reference

```
Audio → useAudioAnalyser → Zustand store (getState 60fps)
                                ↓
                        useThreeScene tick()
                                ↓
          Pass 1: psychedelic.frag → rtA
          Pass 2: trail.frag (rtA + trailRead × 0.82) → trailWrite
          Pass 3: trailWrite → screen
          Particles: cpu update → Points render (additive, no depth)
          Swap trailRead/trailWrite (rtB ↔ rtC)
```

## File Map

| File | Role |
|------|------|
| `src/shaders/psychedelic.frag` | Main visual — FBM, palette, domain warp |
| `src/shaders/psychedelic.vert` | Full-screen quad vertex shader |
| `src/hooks/useThreeScene.js` | Render loop, uniform updates, ping-pong |
| `src/hooks/useAudioAnalyser.js` | FFT → band extraction → store writes |
| `src/store/useStore.js` | Single Zustand store |
| `src/utils/shareUtils.js` | URL serialization/deserialization |
| `src/components/ControlPanel.jsx` | Slider UI |
| `src/components/AudioInput.jsx` | Mic / file selector |
