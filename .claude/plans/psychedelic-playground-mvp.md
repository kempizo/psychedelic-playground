# Psychedelic Playground - Current Product and Architecture Spec

## Product Overview

Psychedelic Playground is a browser-based audio-reactive visual instrument. Users start with microphone input or an uploaded audio file, then shape a fullscreen WebGL scene with live controls, gestures, presets, recording, and shareable URL state.

The experience should feel like one coherent living field rather than a collection of separate visualizers. Sound changes motion, color pressure, texture, trail persistence, and particle activity while preserving smooth continuity across mode changes.

## Current Capabilities

- Audio input through microphone or file upload.
- Web Audio FFT analysis with sub, bass, mid, hi, spectral centroid, and spectral flux values.
- Fullscreen Three.js visual system with raw GLSL shaders loaded via `?raw`.
- Fixed render pipeline: main shader -> trail accumulation -> screen -> particles.
- Five render modes: Fluid, Radial, Vortex, Collapse, and Orbit.
- User controls: speed, intensity, colorShift, chaos, trailDecay, cameraDistance, procIntensity, particleDensity, and mode.
- URL share state for user-facing controls.
- Local presets with save, load, delete, mutate, and shared preset decoding.
- Canvas recording through the browser MediaRecorder path.
- Gesture discoveries for circle, figure-8, rapid-click, and related interaction feedback.

## Architecture

The app is a React 19 + Vite browser app with no backend. `App.jsx` owns top-level experience state and overlays. `VisualCanvas.jsx` keeps the WebGL canvas mounted and wires the audio/render hooks.

Audio is handled by the singleton Web Audio path in `src/audio/` and `src/hooks/useAudioAnalyser.js`. FFT data is converted into normalized features in `src/audio/bands.js`, smoothed in the analyser hook, and written directly to Zustand through `useStore.getState().setAudioData(...)`.

State lives in `src/store/useStore.js`. React components subscribe to user controls and UI state. Render-loop and audio-loop code read or write high-frequency values through `getState()` so audio does not trigger React renders.

Rendering is owned by `src/hooks/useThreeScene.js`. It creates the renderer, uniforms, render targets, force field, particles, gesture handling, visual smoothing, and frame loop. The shader files in `src/shaders/` remain the place for visual math.

Persistence and sharing are handled by `src/utils/shareUtils.js`, `src/hooks/useURLState.js`, and `src/utils/presetUtils.js`. New shareable controls must be added to store defaults, UI controls, URL serialization, preset defaults, mutation ranges when appropriate, and render/shader wiring.

## Critical Contracts

- Do not change the render order: main shader -> trail accumulation -> screen -> particles.
- Do not add render passes or render targets without explicit architecture approval.
- Do not put high-frequency audio data through React render state.
- Fragment shaders paired with `RawShaderMaterial` must declare `precision highp float;`.
- `uMode` and `uPaletteFamily` are GLSL `int` uniforms.
- `uPaletteFamilyBlend` is a GLSL `float` and must remain render-loop smoothed.
- Particles render last with additive blending and must not be included in the trail pass.
- Mode values are stable public state: 0 Fluid, 1 Radial, 2 Vortex, 3 Collapse, 4 Orbit.
- `.claude/rules/` contains the detailed path-scoped contracts and should be checked before touching matching files.

## Product Direction

The MVP is now implemented. Future work should improve the current system incrementally rather than replacing it:

- Better audio responsiveness and silence stability inside the existing Web Audio flow.
- Visual tuning inside the existing shader, trail, and particle paths.
- More polished controls, recording, sharing, and preset workflows.
- Cross-browser and mobile validation.
- Performance tuning that preserves the same architecture.

Avoid backend, auth, database, postprocessing stacks, particle-system rewrites, additional mode counts, or new visual systems unless the user explicitly approves a larger architecture change.
