# Psychedelic Playground - Project Progress

## Status: Current MVP implemented; visual expansion shader/trail/particle passes verified

## Done

### Infrastructure

- [x] Vite + React 19 + Three.js + Zustand app scaffold.
- [x] Tailwind CSS 3 fullscreen dark overlay UI.
- [x] `src/` folder structure for audio, behaviors, components, hooks, shaders, store, three, and utils.
- [x] `.claude/` project docs for rules, plans, agents, skills, and progress.
- [x] `AGENTS.md` universal agent contract and thin `CLAUDE.md` wrapper.

### Visual Engine

- [x] Fullscreen WebGL canvas with Three.js orthographic fullscreen quad.
- [x] Main `psychedelic.frag` SDF/FBM field with palette-family smoothing.
- [x] Fixed render pipeline: main shader -> trail accumulation -> screen -> particles.
- [x] Ping-pong trail accumulation with separate read/write render targets.
- [x] Five render modes: Fluid, Radial, Vortex, Collapse, and Orbit.
- [x] Procedural texture layer modulated by spectral flux and `procIntensity`.
- [x] CPU particle system with fixed buffers, additive blending, mode-aware spawning, density control, and audio reactivity.
- [x] Psychedelic shader expansion with derived audio uniforms, polar folding, spiral torsion, orbit-trap filaments, controlled palette exposure, and trail chromatic shear.
- [x] CPU particle cohesion pass with mode-specific spore/spark/droplet spawning, field-coupled drift, and silence-gated motion.

### Audio

- [x] Singleton Web Audio `AudioContext` and `AnalyserNode`.
- [x] Mic input with user-gesture-safe context resume.
- [x] File audio input with speaker output and analyser routing.
- [x] FFT analysis for sub, bass, mid, hi, spectral centroid, and spectral flux.
- [x] Smoothed audio snapshots written through `useStore.getState().setAudioData(...)`.
- [x] High-frequency audio kept out of React render state.

### Controls, Sharing, and Presets

- [x] User controls for speed, intensity, colorShift, chaos, trailDecay, cameraDistance, procIntensity, particleDensity, and mode.
- [x] Reset-to-default flow.
- [x] URL save/share for user-facing controls.
- [x] Shared preset decoding.
- [x] Local preset save, load, delete, and mutate flows.
- [x] Control defaults and preset backfill for newer controls.

### Interaction and Output

- [x] Landing screen with microphone and upload paths.
- [x] Energy indicator and behavior state feedback.
- [x] Gesture discovery feedback.
- [x] Canvas recording through MediaRecorder.
- [x] Fullscreen and hidden-overlay behavior.

### Documentation

- [x] `AGENTS.md` is the universal source of truth.
- [x] `CLAUDE.md` is a thin Claude-specific wrapper.
- [x] `PLAN.md` is the execution ledger and guardrail map.
- [x] `.claude/rules/` contains path-scoped technical contracts.
- [x] `.claude/plans/psychedelic-playground-visual-expansion-master.md` is the canonical visual expansion prompt.
- [x] Stale root planning artifacts archived under `.claude/archive/`.

## Current Follow-Ups

- [ ] Optional conservative trail edge-growth experiment inside the existing trail shader, only if visual QA shows the current chromatic shear needs more biological residue.
- [ ] Optional Phase 6 audio `DataTexture` prototype from `.claude/plans/psychedelic-playground-visual-expansion-master.md`, only after shader/trail/particle QA and performance checks.
- [ ] Cross-browser test Safari and Chromium for mic/file audio permissions.
- [ ] Mobile check for touch interaction, control layout, and WebGL performance.
- [ ] Error states for mic permission denied and unsupported audio file formats.
- [ ] Performance validation on mid-range hardware.
- [ ] Visual tuning pass using calm, mid, and peak screenshots.

## Architecture Quick Reference

```text
Audio -> useAudioAnalyser -> Zustand store via getState()
                                  |
                                  v
                         useThreeScene tick()
                                  |
                                  v
        Pass 1: psychedelic.frag -> rtA
        Pass 2: trail.frag blends rtA + trailRead -> trailWrite
        Pass 3: trailWrite -> screen
        Particles: additive Points render on top
        Swap trailRead/trailWrite
```

## Known Resolved Issues

| Issue | Status |
|---|---|
| Raw shader precision and attribute declarations | Fixed |
| WebGL feedback loop from reading/writing the same trail target | Fixed |
| URL `history.replaceState` rate limit | Fixed |
| File audio analyser-only routing with no speaker output | Fixed |
| React StrictMode double WebGL context cleanup in dev | Fixed |
| Mode-family hard palette jumps | Fixed |
| Preset mutation/default coupling for new controls | Fixed |
