# Psychedelic Playground - Visual Expansion Master Plan

## Purpose

This is the canonical fresh-session prompt for the next visual expansion pass. It merges the earlier visual expansion plan and add-on plan into one additive, architecture-preserving roadmap.

The lower-risk organic shader, trail, and CPU particle behavior passes have been implemented as of 2026-05-12 using existing smoothed audio data and render-loop-only derived uniforms. The Shadertoy-style audio `DataTexture` prototype is retained as a later optional phase after visual QA and performance checks.

## Source Of Truth And Non-Overlap

- This file owns the detailed visual expansion context. `PLAN.md` and `.claude/docs/progress.md` should only point here or track ledger status, not duplicate this full plan.
- Do not create `.claude/docs/visual-references.md` for this pass unless explicitly requested; the useful reference seeds and motifs are embedded below.
- Future implementation sessions should read this file after `AGENTS.md`, `CLAUDE.md`, and `PLAN.md`, then execute the smallest coherent phase.

## Project Context

- Psychedelic Playground is a browser-only audio-reactive visual instrument with no backend.
- Tech stack: React 19, Vite, Three.js, Zustand, Tailwind 3, and Web Audio API.
- Shaders are loaded as raw GLSL strings via `?raw`; edit `.vert` and `.frag` files directly.
- Rendering is fixed as `main shader -> trail accumulation -> screen -> CPU particles`.
- The render loop lives in `src/hooks/useThreeScene.js` and owns Three.js setup, uniforms, render targets, visual smoothing, forces, gestures, and particles.
- Audio analysis lives in `src/audio/*` and `src/hooks/useAudioAnalyser.js`; high-frequency audio snapshots are written through `useStore.getState().setAudioData(...)`.
- Current user controls: `speed`, `intensity`, `colorShift`, `chaos`, `trailDecay`, `cameraDistance`, `procIntensity`, `particleDensity`, and `mode`.
- Current audio features include `sub`, `bass`, `lowMid`, `mid`, `highMid`, `treble`, `hi`, `rms`, `energy`, `energyEnvelope`, `predictedEnergy`, `onset`, `bassPulse`, `midPulse`, `treblePulse`, `beatPhase`, `spectralCentroid`, `spectralFlux`, and `silence`.
- Five existing mode IDs are public state and must remain stable:
  - `0 Fluid`
  - `1 Radial`
  - `2 Vortex`
  - `3 Collapse`
  - `4 Orbit`

## Current Baseline Notes

- Last known clean implementation baseline from the visual expansion planning conversation: `git status --short` clean, `npm run lint` passed, `npm run build` passed, and `git diff --check` passed.
- The production build may emit the existing Vite large-chunk warning; treat that as known unless a new warning appears.
- Do not rely on stale baseline notes. Phase 0 must re-run the checks before source edits.

## Guardrails

- No backend, runtime dependency, new UI control, URL/share key, preset schema change, mode ID change, render pass, render target, GPU particle system, full fluid simulation, or true reaction-diffusion system.
- Preserve the existing app architecture, file ownership, and render order.
- Keep audio data out of React render state; use non-subscribing `getState()` reads/writes for audio and render-loop data.
- Keep pointer steering visual-only and drag/press based; do not add hover-only steering or persistent input state.
- Particles remain CPU-driven with `MAX_PARTICLES = 128`, `THREE.Points`, fixed buffers, and additive rendering last.
- Fragment shaders paired with `RawShaderMaterial` must keep explicit `precision highp float;`.
- Preserve `uMode` and `uPaletteFamily` as `int` uniforms and `uPaletteFamilyBlend` as a render-loop-smoothed `float`.
- Avoid visible rings, equalizer bars, pasted outlines, full-frame flashes, or flat wallpaper-like Voronoi.
- Keep new procedural work outside the raymarch loop unless it replaces an existing calculation with equal or lower cost.

## Reference Direction

Use these as motifs and implementation guidance, not as copied code:

- The Book of Shaders: fBM, domain warping, cellular noise, and layer composition.
- Inigo Quilez: domain-warped fields, cosine palettes, smooth Voronoi, and voronoise.
- Shadertoy-style organic tunnel, Voronoi, feedback, and audio-reactive motifs.
- Curl-noise-style flow and directional motion without implementing a full fluid sim.
- MDN/Web Audio `AnalyserNode` behavior, byte frequency data, time-domain waveform data, and smoothing conventions.
- Three.js `DataTexture`, render target, shader material, and buffer geometry documentation for the optional audio texture phase.

Seed references:

- https://iquilezles.org/articles/warp/
- https://iquilezles.org/articles/palettes/
- https://iquilezles.org/articles/smoothvoronoi/
- https://iquilezles.org/articles/voronoise/
- https://www.shadertoy.com/view/fdSyWz
- https://thebookofshaders.com/13/
- https://thebookofshaders.com/12/
- https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode
- https://threejs.org/docs/pages/DataTexture.html
- https://threejs.org/docs/#api/en/core/BufferGeometry
- https://threejs.org/manual/en/rendertargets.html
- https://threejs.org/examples/webgl_shader_lava.html

## Phased Implementation

## Implementation Status

- Completed: Phase 0 baseline checks, Phase 1 main shader organic field, derived audio uniform pass, mode-weighted kaleidoscope/torsion shaping, orbit-trap filaments, controlled palette/exposure tuning, subtle trail chromatic shear, and Phase 5 CPU particle cohesion.
- Deferred: conservative trail edge-growth remains optional because the current trail pass uses stable chromatic shear without extra texture samples.
- Deferred: Phase 6 audio `DataTexture` remains optional and should wait for visual QA/performance validation.

### Phase 0 - Fresh Context And Baseline

- Read `AGENTS.md`, `CLAUDE.md`, `PLAN.md`, `.claude/docs/progress.md`, `.claude/rules/*`, `src/hooks/useThreeScene.js`, `src/shaders/*`, and `src/audio/*`.
- Confirm `git status --short` is clean or identify unrelated user changes before editing.
- Run baseline `npm run lint`, `npm run build`, and `git diff --check`.
- Treat the current fixed pipeline and current controls as the boundary for the visual pass.

### Phase 1 - Main Shader Organic Field

- In `src/shaders/psychedelic.frag`, add conservative `fbm2`, `warpField`, and subtle `kaleido` helpers.
- Add `curl2` only if the first shader budget remains healthy.
- Apply multi-stage warped coordinates once per fragment before camera/mode shaping, then reuse them for background texture, procedural layer, fog, filaments, and mode bias.
- Preserve the existing SDF/raymarch structure and keep new work outside the raymarch loop.
- Keep silence stable with slow autonomous drift rather than jitter.

### Phase 2 - Cellular And Vein Layer

- Add one lightweight 3x3 `cellularEdge` helper evaluated on already-warped coordinates.
- Use it as local biological surface/fog/filament detail, not as a flat Voronoi overlay.
- Reveal the vein layer with `uProcIntensity`, `uHighMid`, `uTreble`, `uTreblePulse`, and `uOnset`.
- Reduce the layer during `uSilence` so the visual settles instead of crawling.
- Do not create rings, bars, pasted outlines, or wallpaper-like cells.

### Phase 3 - Mode-Specific Visual Engines

- In `src/hooks/useThreeScene.js`, add internal smoothed engine weights mapped to existing modes:
  - `0 Fluid -> Organic Tunnel`
  - `1 Radial -> Liquid Mandala`
  - `2 Vortex -> Neural Bloom`
  - `3 Collapse -> Mycelium Pulse`
  - `4 Orbit -> Plasma Creature`
- Expose internal shader uniforms only, such as `uEngineA = vec4(macroWarp, cellularVein, mandalaBias, shimmer)` and `uEngineB = vec4(particleBurst, trailFlow, audioTexture, residue)`.
- Smooth these weights locally in the render loop with existing dt-based easing.
- Do not add UI controls, store user-control fields, share keys, preset fields, or new public mode state.

### Phase 4 - Trail Feedback

- Upgrade only `src/shaders/trail.frag` and its existing material uniforms from `useThreeScene.js`.
- Add directional smear, luminance-aware decay, subtle treble chromatic split, onset/bass preservation, and silence cleanup.
- If needed, pass existing audio values such as `uBass`, `uBassPulse`, `uSpectralFlux`, and `uSilence` into the trail shader.
- Start from low-cost sampling, ideally 3 previous-frame samples; expand only up to a conservative 5-tap diffusion if QA and performance remain stable.
- Keep hardcoded internal constants so the trail upgrade can be reduced or disabled quickly if it blurs or drops frames.
- Do not add render passes, render targets, or include particles in the trail.

### Phase 5 - CPU Particles

- Keep `MAX_PARTICLES = 128`, `THREE.Points`, existing typed arrays, and additive compositing last.
- Refine `spawnParticleForMode` and live velocity updates so particles feel like spores in the same organic field.
- Mode targets:
  - Fluid: tunnel rim drift and tissue-like curl.
  - Radial: mandala arcs and breathing folds.
  - Vortex: tangential bloom bursts.
  - Collapse: inward mycelium branches with controlled release on onset.
  - Orbit: stable orbital seams and seam-biased shimmer.
- Use bass for broad motion, mids for swirl/twist, treble/onset for sparkle and acceleration, and silence for reduced jitter.
- Touch `src/shaders/particle.vert` only if size, opacity, or color cohesion needs shader support.

### Phase 6 - Optional Audio Texture Prototype

- Implement only after Phases 1-5 pass visual QA and performance checks.
- Add a Shadertoy-style `512x2 RGBA Uint8Array` audio buffer outside React state:
  - Row 0: lower 512 FFT bins.
  - Row 1: waveform resampled to 512.
- `useAudioAnalyser.js` may write mutable shared data and increment a frame counter.
- `useThreeScene.js` owns the `THREE.DataTexture`, marks `needsUpdate` only when the frame counter changes, and disposes it on cleanup.
- `psychedelic.frag` may add `uAudioTex`, `uAudioTexReady`, `fft(x)`, and `wave(x)`.
- Use the texture subtly for spatial modulation only; do not make it the primary motion source.

### Phase 7 - Deferred Research

- Document but do not implement true reaction-diffusion residue.
- Document but do not implement GPU particle FBOs.
- Document but do not implement full fluid simulation.
- Document but do not implement extra render targets, extra render passes, shader chunk modularization, dependency additions, or a replacement rendering stack.

## First Executable Slice

- Status: completed and superseded by the verified shader/trail/particle passes logged in `PLAN.md`.
- Run Phase 0 first: read required context, confirm worktree state, and run baseline checks.
- If baseline is clean, execute Phase 1 only as the first implementation slice.
- Phase 1 should primarily touch `src/shaders/psychedelic.frag`; avoid `useThreeScene.js`, `trail.frag`, particles, `DataTexture`, or new uniforms unless a compile issue makes a tiny supporting edit unavoidable.
- Implement `fbm2`, `warpField`, and subtle `kaleido` reuse outside the raymarch loop; do not add the cellular/vein layer yet.
- Verify with `npm run lint`, `npm run build`, and `git diff --check`, then append one dated `✅` ledger line to `PLAN.md`.

## Audio Mapping

- `sub`: slow breathing, tunnel depth bend, and camera drift.
- `bass` / `bassPulse`: large body motion, forceful organic push/pull, and trail preservation.
- `lowMid`: blob thickness and SDF displacement.
- `mid` / `midPulse`: folding, twisting, secondary warp, and spiral complexity.
- `highMid`: vein contrast and cellular edge reveal.
- `treble` / `hi` / `treblePulse`: micro-ridges, shimmer, particle sparkle, and chromatic trail split.
- `spectralCentroid`: palette phase and color-temperature direction.
- `spectralFlux` / `onset`: temporary chaos burst and controlled release, not constant jitter.
- `silence`: reduced warp and jitter while preserving slow autonomous drift.

## QA And Acceptance

- Required after each implementation checkpoint: `npm run lint`, `npm run build`, and `git diff --check`.
- Visual QA: no audio, quiet audio, bass-heavy audio, treble-heavy audio, transient-heavy audio, all five modes, drag force, UI click isolation, fullscreen with `H`, and no shader compile errors.
- Capture calm, mid, and peak screenshots when tuning visual feel.
- Performance acceptance: no obvious desktop frame collapse; if a feature causes instability, reduce or disable it with the planned internal constants and keep stable work.
- Regression acceptance: audio data still bypasses React state, particles render last, trail ping-pong never samples and writes the same target, and palette family transitions still pass through `uPaletteFamilyBlend`.
- Visual acceptance: the scene feels more alive and layered for 30-60 seconds, bass/mids/highs produce distinct behavior, silence is stable, particles feel field-coupled, and the trail feels like biological memory.

## Assumptions

- This file is the canonical fresh-session prompt for the visual expansion.
- The immediate pass is Phases 1-5.
- Phase 6 audio texture work is optional and should wait for stable QA from Phases 1-5.
- No new dependencies, UI controls, backend, render targets, render passes, GPU particles, full fluid sim, or true reaction-diffusion will be added without explicit architecture approval.
- Future implementers should append one dated `✅` implementation-ledger line to `PLAN.md` after any verified visual-expansion implementation slice.
