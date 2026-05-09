# Psychedelic Playground

A browser-based audio-reactive visual experience. Mic or audio file input drives a real-time WebGL shader (FBM domain warping, teal/green/violet palette) with trailing echo and a minimal particle system. State is shareable via URL params. No backend.

## Quick start

```bash
npm run dev      # dev server at http://localhost:5173
npm run build    # production build
npm run preview  # preview production build
npm run lint     # eslint
```

Node 18+ required. Three.js dev tools are useful for shader debugging.

## Tech stack

- **React 19 + Vite** — no SSR, fast HMR, shaders loaded via `?raw` imports
- **Three.js** — full-screen quad with `RawShaderMaterial`, three-pass render loop
- **Zustand** — single store, written directly via `getState()` for 60fps updates
- **Tailwind 3** — utility classes for the overlay UI
- **Web Audio API** — `AnalyserNode` (FFT 2048), 4 frequency bands

No backend. Save/share serializes 5 controls to URL query params.

## Critical conventions

These are non-obvious and break things if violated. Path-scoped details live in [.claude/rules/](.claude/rules/).

1. **Audio data NEVER goes through React state.** `useAudioAnalyser` writes 60×/sec via `useStore.getState().setAudioData(...)` — calling `set` from a React component would re-render the whole tree at 60fps. The render loop reads via `useStore.getState()` inside `requestAnimationFrame`.

2. **Shaders are loaded as raw strings via `?raw`.** Never inline GLSL in JS unless trivially small (the final-pass passthrough shader is the only exception). Edit the `.vert`/`.frag` files directly.

3. **Color palette is open neon spectrum, driven by depth + energy + value.** `uPaletteFamily` remains the snapped mode-family contract, while `uPaletteFamilyBlend` is render-loop-smoothed so modes 0/1 ↔ 2/3/4 do not hard-jump palettes. Brightness stays localized — no full-frame color flashes. See [.claude/rules/shaders.md](.claude/rules/shaders.md).

4. **Render pipeline is three passes per frame** (main → trail blend → screen). The main pass writes to a fresh target; trail accumulation ping-pongs between two separate targets so the shader never samples and writes the same texture. Particles render last with `autoClear=false`. Swap order matters. See [.claude/rules/render-pipeline.md](.claude/rules/render-pipeline.md).

5. **All `RawShaderMaterial` shaders MUST declare `precision highp float;`** at the top of the fragment shader. `ShaderMaterial` injects this; `RawShaderMaterial` does not.

6. **GLSL int vs float matters.** `uMode` and `uPaletteFamily` are `int`; `uPaletteFamilyBlend` is `float`. Integer literals like `1` go to `int` uniforms, `1.0` to `float` uniforms. Mismatches fail silently.

7. **AudioContext requires a user gesture to start (Safari).** Always call `resumeContext()` from inside a click handler. See [src/audio/analyser.js](src/audio/analyser.js).

8. **Mode continuity is local to the render loop.** UI buttons and store `mode` values still switch immediately, but `useThreeScene.js` eases visual transition state, palette family, trail hold, and particle spawn style. Do not move this into UI state without an explicit architecture change.

## File map

```
src/
├── App.jsx                    Top-level: mounts canvas, landing, panel, share
├── main.jsx                   Vite entry
├── index.css                  Tailwind + global resets
│
├── audio/
│   ├── analyser.js            Singleton AudioContext + AnalyserNode
│   ├── bands.js               FFT array → {sub, bass, mid, hi}
│   ├── mic.js                 getUserMedia → AnalyserNode
│   └── fileAudio.js           File → AudioBuffer → looped playback
│
├── three/
│   ├── renderer.js            WebGLRenderer factory + resize
│   ├── scene.js               OrthographicCamera factory
│   ├── quad.js                Full-screen PlaneGeometry helper
│   └── renderTargets.js       Ping-pong WebGLRenderTarget pair
│
├── shaders/
│   ├── psychedelic.vert       Passthrough vertex
│   ├── psychedelic.frag       Main SDF/FBM field + smoothed palette blend
│   ├── trail.frag             Frame-blend with dynamic decay
│   ├── particle.vert          Point sprite vertex + matched palette blend
│   └── particle.frag          Soft circular point fragment
│
├── hooks/
│   ├── useThreeScene.js       Owns render loop, uniforms, visual smoothing, particles
│   ├── useAudioAnalyser.js    rAF loop reading FFT, smoothing, → Zustand
│   └── useURLState.js         Hydrate from URL on mount, sync controls back
│
├── store/
│   └── useStore.js            Zustand: audioData + 5 controls + audioSource
│
├── behaviors/
│   └── BehavioralController.js  State machine: calm/build/peak/afterglow, energy, break events
│
├── components/
│   ├── VisualCanvas.jsx       Mounts canvas, calls hooks (forwardRef → exposes canvas to App)
│   ├── LandingScreen.jsx      Initial CTA overlay (mic/upload)
│   ├── AudioInput.jsx         Mic permission + file picker
│   ├── ControlPanel.jsx       4 sliders + mode toggle (5 modes)
│   ├── ShareButton.jsx        Serialize state → clipboard
│   ├── EnergyIndicator.jsx    Real-time energy/state display
│   ├── PresetPanel.jsx        Save/load/mutate named presets
│   ├── RecordButton.jsx       Canvas → WebM recording (8s / shift+16s)
│   └── DiscoveryToast.jsx     Gesture unlock notifications (queued, one at a time)
│
└── utils/
    ├── shareUtils.js          Serialize/deserialize URL params
    ├── mathUtils.js           lerp, clamp, smoothstep
    ├── presetUtils.js         Preset CRUD + mutation logic
    ├── recordUtils.js         canvas.captureStream → MediaRecorder → WebM download
    └── gestures.js            Mouse ring buffer + circle/figure-8/rapid-click/idle detectors
```

## Audio → visual mapping

| Band | Hz range | Drives |
|------|----------|--------|
| `sub` | 0–86 | `uCamDrift` accumulator (slow inertial camera wander) + `uSub` per-frame |
| `bass` | 86–430 | Scale warp, brightness pulse on kick, force spawn at blob center (push) |
| `mid` | 430–2150 | Domain distortion intensity, trail decay |
| `hi` | 2150–8600 | Fine noise, particle spawn rate, shimmer |

User `Intensity` slider multiplies all bands before they hit the shader.

## Known issues (open, not yet fixed)

No current lint failures are known as of the Safe Mode Continuity Fix (`npm run lint` passes).

Previously tracked issues now resolved: palette red zone fixed, touch events added (`touchmove` → `rawMouse`), `THREE.Clock` migrated to `THREE.Timer`, and mode-family palette jumps softened via `uPaletteFamilyBlend`.

## Plan

The MVP plan that this codebase implements is at [.claude/plans/psychedelic-playground-mvp.md](.claude/plans/psychedelic-playground-mvp.md). Treat it as the spec.

## When working in specific areas

These rules auto-load only when matching files are open — see frontmatter `paths:` field in each:

- [.claude/rules/shaders.md](.claude/rules/shaders.md) — GLSL conventions, palette, FBM patterns
- [.claude/rules/audio.md](.claude/rules/audio.md) — Web Audio API patterns, mic/file flow
- [.claude/rules/render-pipeline.md](.claude/rules/render-pipeline.md) — three.js render loop, ping-pong, particles
- [.claude/rules/state.md](.claude/rules/state.md) — Zustand patterns, URL sync, no audio in React

## Subagents and skills

- `/agents` → see `.claude/agents/shader-tuner.md` for GLSL-focused work
- `/add-control` → end-to-end skill that adds a new slider (store + UI + uniform + shader)
