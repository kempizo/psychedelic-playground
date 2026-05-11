# Psychedelic Playground

Psychedelic Playground is a browser-based audio-reactive visual experience. Microphone or audio file input drives a fullscreen Three.js shader field with trail accumulation, particles, gestures, presets, recording, and URL-shareable controls.

There is no backend. The app runs entirely in the browser with React, Vite, Three.js, Zustand, Tailwind, and the Web Audio API.

## Quick Start

```bash
npm run dev      # local dev server
npm run build    # production build
npm run preview  # preview production build
npm run lint     # eslint
```

Node 18+ is required.

## Current App Shape

- Fullscreen Three.js quad using raw GLSL loaded with `?raw`.
- Fixed render order: main shader -> trail accumulation -> screen -> particles.
- Audio analysis uses an `AnalyserNode` with FFT 2048, sub/bass/mid/hi bands, spectral centroid, and spectral flux.
- Zustand stores user controls, audio snapshots, energy state, discoveries, recording state, and presets.
- High-frequency audio is written through `useStore.getState().setAudioData(...)`; it must not flow through React render state.
- URL sharing serializes user controls through `src/utils/shareUtils.js`.
- Presets are stored in localStorage and can be saved, loaded, shared, and mutated.

## Controls

The current user-facing controls are:

- `speed`
- `intensity`
- `colorShift`
- `chaos`
- `trailDecay`
- `cameraDistance`
- `procIntensity`
- `particleDensity`
- `mode`

Modes are `Fluid`, `Radial`, `Vortex`, `Collapse`, and `Orbit`.

## Documentation Map

- `AGENTS.md` is the universal contract for all coding agents.
- `CLAUDE.md` is a thin Claude-specific wrapper.
- `PLAN.md` is the active execution ledger and guardrail map.
- `.claude/rules/` contains path-scoped technical rules.
- `.claude/plans/psychedelic-playground-mvp.md` is the current product and architecture spec.
- `.claude/docs/progress.md` is the current project status snapshot.
- `.claude/archive/` contains historical prompts and plans that are not active guidance.
- `.codex/` is retained for Codex-specific TOML configuration.

## Verification

Use these checks before reporting changes done:

```bash
npm run lint
npm run build
git diff --check
```

For visual changes, also run the dev server and check that the app loads without WebGL or shader errors.
