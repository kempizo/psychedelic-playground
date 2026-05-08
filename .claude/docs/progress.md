# Psychedelic Playground — Project Progress

## Status: MVP feature-complete, shader fix applied

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

---

## What's Next

### High Priority
- [ ] **Cross-browser test** — Safari requires `audioContext.resume()` inside a click; test mic + file on Safari 17+
- [ ] **Mobile check** — reduce `fftSize` to 1024 on small screens, verify touch controls work
- [ ] **Error states** — mic permission denied banner, file format unsupported warning
- [ ] **GitHub remote** — push to GitHub (`gh repo create` or manual remote setup)

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

---

## Architecture Quick Reference

```
Audio → useAudioAnalyser → Zustand store (getState 60fps)
                                ↓
                        useThreeScene tick()
                                ↓
          Pass 1: psychedelic.frag → rtA
          Pass 2: trail.frag (rtA + rtB × 0.82) → rtB
          Pass 3: rtB → screen
          Particles: cpu update → Points render (additive, no depth)
          Swap rtA/rtB
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
