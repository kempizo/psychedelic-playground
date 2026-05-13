# Psychedelic Playground - Visual Expansion Master Plan

## Purpose

This is the canonical fresh-session prompt for the next visual expansion pass. It merges the earlier visual expansion plan, the add-on plan, and the Expansion Track E organic-journey direction into a single additive, architecture-preserving roadmap with one stage sequence (`Stage 0-10`).

The lower-risk organic shader, trail, and CPU particle behavior passes have been implemented as of 2026-05-12 using existing smoothed audio data and render-loop-only derived uniforms. The Shadertoy-style audio `DataTexture` prototype is retained as a later optional stage after visual QA and performance checks.

## Source Of Truth And Non-Overlap

- This file owns the detailed visual expansion context. `PLAN.md` and `.claude/docs/progress.md` should only point here or track ledger status, not duplicate this full plan.
- Do not create `.claude/docs/visual-references.md` for this pass unless explicitly requested; the useful reference seeds and motifs are embedded below.
- Future implementation sessions should read this file after `AGENTS.md`, `CLAUDE.md`, and `PLAN.md`, then execute the smallest coherent stage.

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
- Do not rely on stale baseline notes. Stage 0 must re-run the checks before source edits.

## Guardrails

- No backend, runtime dependency, new UI control, URL/share key, preset schema change, mode ID change, render pass, render target, GPU particle system, full fluid simulation, or true reaction-diffusion system.
- Preserve the existing app architecture, file ownership, and render order (`main shader -> trail -> screen -> CPU particles`).
- Keep audio data out of React render state; use non-subscribing `getState()` reads/writes for audio and render-loop data.
- Keep pointer steering visual-only and drag/press based; do not add hover-only steering or persistent input state.
- Particles remain CPU-driven with `MAX_PARTICLES = 128`, `THREE.Points`, fixed buffers, and additive rendering last.
- Fragment shaders paired with `RawShaderMaterial` must keep explicit `precision highp float;`.
- Preserve `uMode` and `uPaletteFamily` as `int` uniforms and `uPaletteFamilyBlend` as a render-loop-smoothed `float`.
- Avoid visible rings, equalizer bars, pasted outlines, full-frame flashes, or flat wallpaper-like Voronoi.
- Keep new procedural work outside the raymarch loop unless it replaces an existing calculation with equal or lower cost.
- Do not undo stabilization work (no return of the stroke-like glow, no abrupt slider/mode jumps, no random click-like distortion, no ghosting/frame clash regressions).
- Do not reintroduce harsh motion. Silence trends calm; audio gradually wakes the system.
- Do not increase trail feedback aggression beyond the Stage 5 envelope.
- Do not add visible kaleidoscopic symmetry beyond what is already softened in `kaleido` usage.
- Do not block or obscure UI controls; atmosphere/depth must not reduce readability.
- Each shipped slice stays focused, reversible, and visually verifiable, and gets one dated `✅` ledger line in `PLAN.md`.
- No new public mode IDs, store keys, URL/share keys, or preset schema fields without architecture approval.

## Reference Direction

Use these as motifs and implementation guidance, not as copied code:

- The Book of Shaders: fBM, domain warping, cellular noise, and layer composition.
- Inigo Quilez: domain-warped fields, cosine palettes, smooth Voronoi, and voronoise.
- Shadertoy-style organic tunnel, Voronoi, feedback, and audio-reactive motifs.
- Curl-noise-style flow and directional motion without implementing a full fluid sim.
- MDN/Web Audio `AnalyserNode` behavior, byte frequency data, time-domain waveform data, and smoothing conventions.
- Three.js `DataTexture`, render target, shader material, and buffer geometry documentation for the optional audio texture stage.

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

## Implementation Status

- Completed: Stage 0 baseline checks, Stage 1 main shader organic field (derived audio uniform pass, mode-weighted kaleidoscope/torsion shaping, orbit-trap filaments, controlled palette/exposure tuning, subtle trail chromatic shear), Stage 2 organic atmosphere haze, Stage 3 cellular vein layer, Stage 4 mode engines + journey state model, Stage 5 trail feedback upgrade (S5/S6 stabilization), Stage 6 CPU particle cohesion pass, Stage 11 Phase 1 tunnel & portal depth field (polar log-depth layer, gill ridges, portal bloom, seam fix, visibility tuning), Stage 11 Phase 2 particle ecosystem refinement, Fungal Journey Slice 6 named phase multipliers, the focused fungal visual refinement pass, and the Living Portal / structured psychedelic color upgrade.
- Unshipped (in-scope for the next pass): Stage 11 Phase 4 trail polish only if muddiness returns, and any further Stage 11 Phase 5 Fluid/Vortex structural distinction beyond the shipped phase gates.
- Deferred inside Stage 5: conservative trail edge-growth remains optional because the current trail pass uses stable chromatic shear without extra texture samples.
- `[Optional]`: Stage 7 audio `DataTexture`, Stage 8 reaction-diffusion-inspired prototype, Stage 9 journey preset/mode system.
- `[Deferred]`: Stage 10 research-only items.

## Stage Implementation

### Stage 0 - Fresh Context And Baseline [Shipped]

- Read `AGENTS.md`, `CLAUDE.md`, `PLAN.md`, `.claude/docs/progress.md`, `.claude/rules/*`, `src/hooks/useThreeScene.js`, `src/shaders/*`, and `src/audio/*`.
- Confirm `git status --short` is clean or identify unrelated user changes before editing.
- Run baseline `npm run lint`, `npm run build`, and `git diff --check`.
- Treat the current fixed pipeline and current controls as the boundary for the visual pass.
- Stabilization baseline audit (before any unshipped stage edit): confirm S0-S6 stabilization passes and Stage 1 / Stage 6 cohesion are intact, re-run lint/build/diff, and spot-check that there is no stroke-like glow border, no abrupt slider/mode pop, no silent-state runaway motion, no spurious distortion impulses, and no trail ghost clash. This is a confirmation step, not a re-run of the full baseline.

### Stage 1 - Main Shader Organic Field [Shipped]

- In `src/shaders/psychedelic.frag`, add conservative `fbm2`, `warpField`, and subtle `kaleido` helpers.
- Add `curl2` only if the first shader budget remains healthy.
- Apply multi-stage warped coordinates once per fragment before camera/mode shaping, then reuse them for background texture, procedural layer, fog, filaments, and mode bias.
- Preserve the existing SDF/raymarch structure and keep new work outside the raymarch loop.
- Keep silence stable with slow autonomous drift rather than jitter.

### Stage 2 - Organic Atmosphere And Depth Layer [Unshipped]

- Purpose: subtle mist, vapor, aura, parallax, and depth around/behind the main visual.
- Direction:
  - Slow organic drift; atmospheric haze; subtle volumetric feel.
  - `audioPresence` (defined in Stage 4) lifts density/intensity slightly; silence stays calm and breathing.
  - Read as atmosphere, not as a hard outline glow.
- Implementation hooks (no architecture change):
  - Add atmosphere contribution inside `psychedelic.frag` reusing the existing warped coordinates from Stage 1.
  - Composite behind/around the blob using existing depth/proximity terms; do not add a render target.
  - Cap contribution amplitude so it cannot dominate the blob or smear into the trail.
- Must not increase ghosting/frame clash or thicken the perceived blob outline.

### Stage 3 - Cellular And Vein Layer [Unshipped]

- Add one lightweight 3x3 `cellularEdge` helper evaluated on already-warped coordinates.
- Use it as local biological surface/fog/filament detail, not as a flat Voronoi overlay.
- Reveal the vein layer with `uProcIntensity`, `uHighMid`, `uTreble`, `uTreblePulse`, and `uOnset`.
- Reduce the layer during `uSilence` so the visual settles instead of crawling.
- Do not create rings, bars, pasted outlines, or wallpaper-like cells.
- Direction overlay: subtle organic internal detail (mycelium veins, cellular membrane, fungal/coral growth hints) inside the blob/surface. Low contrast, slow crawl, masked into blob/surface/atmosphere rather than full-frame. Audio reveals detail rather than violently animating it. Use one cellular-edge helper on already-warped coords; do not add a second domain warp.

### Stage 4 - Mode-Specific Visual Engines And Journey State [Shipped; Slice 6 extended]

- In `src/hooks/useThreeScene.js`, add internal smoothed engine weights mapped to existing modes:
  - `0 Fluid -> Organic Tunnel`
  - `1 Radial -> Liquid Mandala`
  - `2 Vortex -> Neural Bloom`
  - `3 Collapse -> Mycelium Pulse`
  - `4 Orbit -> Plasma Creature`
- Expose internal shader uniforms only, such as `uEngineA = vec4(macroWarp, cellularVein, mandalaBias, shimmer)` and `uEngineB = vec4(particleBurst, trailFlow, audioTexture, residue)`.
- Smooth these weights locally in the render loop with existing dt-based easing.
- Do not add UI controls, store user-control fields, share keys, preset fields, or new public mode state.
- Journey / intensity state model (render-loop-local derived controls, not store fields):
  - `audioPresence`, `journeyIntensity`, `calmMotion`, `bloomEnergy`, `warpDepth`, `atmosphereDensity`, `particleActivity`, `trailPersistence`, `surfaceDetail`, `tunnelPull`.
  - Desired progression: `Dormant -> Breathing -> Awakening -> Blooming -> Traversal -> Dissolution -> Return`.
  - Slice 6 now names the progression as five render-loop-local phases: `idle-mycelium`, `breathing-organism`, `gills-portal-pull`, `bloom-breakthrough`, and `afterglow`.
  - Phase multipliers ease over ~1.2s and gate existing spore density, portal bloom, tunnel pull, trail decay, and palette heat. They are exposed only as DEV globals for Puppeteer verification, not React/store state.
  - Focused refinement retuned phase targets to cool idle/afterglow, make build the strongest inward-pull phase, make peak portal-heavy without flat full-frame heat, and add a small phase-based lift to existing tunnel depth/gill/spiral locals.
  - Silence trends toward `Dormant`/`Breathing`. Audio gradually wakes the system; bass drives body/pressure, mids drive morphology/flow, highs drive shimmer/detail.
  - `onset` produces brief accents only when `audioPresence` is non-trivial.
  - No single band may independently cause chaotic global motion.
  - Smooth each derived control with the existing dt-based easing already used for `uPaletteFamilyBlend` and engine weights.
  - Feed `uEngineA` / `uEngineB` and other internal uniforms (including Stage 2 atmosphere density and Stage 6 particle activity) from these locals; do not promote them to React state, UI controls, URL keys, or preset fields.

### Stage 5 - Trail Feedback [Unshipped]

- Upgrade only `src/shaders/trail.frag` and its existing material uniforms from `useThreeScene.js`.
- Add directional smear, luminance-aware decay, subtle treble chromatic split, onset/bass preservation, and silence cleanup.
- If needed, pass existing audio values such as `uBass`, `uBassPulse`, `uSpectralFlux`, and `uSilence` into the trail shader.
- Start from low-cost sampling, ideally 3 previous-frame samples; expand only up to a conservative 5-tap diffusion if QA and performance remain stable.
- Keep hardcoded internal constants so the trail upgrade can be reduced or disabled quickly if it blurs or drops frames.
- Do not add render passes, render targets, or include particles in the trail.

### Stage 6 - CPU Particles [Cohesion Shipped; Ecosystem Refinement Unshipped]

- Keep `MAX_PARTICLES = 128`, `THREE.Points`, existing typed arrays, and additive compositing last.
- Refine `spawnParticleForMode` and live velocity updates so particles feel like spores in the same organic field.
- Slice 6 phase gating now scales particle spawn rate, ambient dust chance, and particle shader density through the existing render-loop locals; the focused refinement reduced high-density particle alpha/size in `particle.vert` so peak spores integrate with the tunnel instead of whitening the foreground. No new particle buffers or uniforms were added.
- Mode targets:
  - Fluid: tunnel rim drift and tissue-like curl.
  - Radial: mandala arcs and breathing folds.
  - Vortex: tangential bloom bursts.
  - Collapse: inward mycelium branches with controlled release on onset.
  - Orbit: stable orbital seams and seam-biased shimmer.
- Use bass for broad motion, mids for swirl/twist, treble/onset for sparkle and acceleration, and silence for reduced jitter.
- Touch `src/shaders/particle.vert` only if size, opacity, or color cohesion needs shader support.
- Ecosystem refinement direction (on top of the shipped cohesion baseline):
  - Evolve into a more natural living ecosystem (spores, embers, pollen, dust, microscopic life) within the existing architecture.
  - Near/mid/far depth strata via size + opacity + parallax, not extra geometry.
  - Silence: suspended drift, near-zero acceleration.
  - Bass: subtle outward pressure; mids: curling flow; highs: shimmer/flicker/detail.
  - Slow currents; no symmetrical orbits, no starfield jitter, no explosion bursts.
  - Reuse the field/curl signals already established in Stages 1 and 4.

### Stage 7 - Audio Texture Prototype [Optional]

- Implement only after Stages 1-6 pass visual QA and performance checks.
- Add a Shadertoy-style `512x2 RGBA Uint8Array` audio buffer outside React state:
  - Row 0: lower 512 FFT bins.
  - Row 1: waveform resampled to 512.
- `useAudioAnalyser.js` may write mutable shared data and increment a frame counter.
- `useThreeScene.js` owns the `THREE.DataTexture`, marks `needsUpdate` only when the frame counter changes, and disposes it on cleanup.
- `psychedelic.frag` may add `uAudioTex`, `uAudioTexReady`, `fft(x)`, and `wave(x)`.
- Use the texture subtly for spatial modulation only; do not make it the primary motion source.

### Stage 8 - Reaction-Diffusion-Inspired Prototype [Optional]

- Status: optional, isolated, and gated. Requires explicit architecture approval before code lands, because the Stage 10 guardrail says "do not implement true reaction-diffusion residue."
- Purpose: prototype a lightweight organic growth texture inspired by reaction-diffusion / mycelium / coral / cellular patterns.
- Constraints:
  - Low contrast, performance-safe, no full-screen noisy overload.
  - No worsened ghosting/frame clash, no harsh outlines, no rapid random pulses.
  - Flag or preset-gated; off by default.
- Allowed approaches in priority order:
  1. Lightweight procedural *fake* reaction-diffusion texture in GLSL (preferred; no new buffers).
  2. Small reduced-resolution ping-pong simulation (only with architecture approval; new render target).
  3. Trail-buffer modulation (only if the existing `trail.frag` pass can host it without re-sampling and writing the same target).
- Default if not explicitly unblocked: stays documented, not implemented.

### Stage 9 - Journey Preset / Mode System [Optional]

- Status: optional, sequenced after Stages 2-6 have shipped and passed visual QA.
- Purpose: organize the journey layers into coherent journey presets rather than disconnected modes.
- Direction:
  - Presets feel like different journeys, not random visual modes.
  - Transitions remain smooth via existing smoothed weights.
  - UI readability preserved; audio reactivity stays bounded and tasteful.
- Implementation hooks:
  - Compose journey presets as named bundles of Stage 4 derived-control targets layered over the existing five mode IDs (`0 Fluid`...`4 Orbit`). Existing mode IDs and order remain stable.
  - Do not add public preset schema fields, store keys, or URL/share keys without architecture approval.

### Stage 10 - Deferred Research [Deferred]

- Document but do not implement true reaction-diffusion residue.
- Document but do not implement GPU particle FBOs.
- Document but do not implement full fluid simulation.
- Document but do not implement extra render targets, extra render passes, shader chunk modularization, dependency additions, or a replacement rendering stack.

### Stage 11 - Tunnel & Portal Depth Field [Phase 1 Shipped; Phases 2–5 Unshipped]

Diagnosis that motivated this stage: despite Stages 1–6 shipping, the scene still read as "one pale blob in a dark room." The background was volumetric glow on miss-rays only; no concentric/polar depth structure existed; atmosphere was hard-clamped at 0.035; cellular veins were surface-only; Fluid and Vortex modes lacked structural signatures.

Constraints: no new render passes, render targets, store keys, URL/share keys, preset fields, or public mode IDs. New internal-only shader uniforms are allowed. All driving values stay render-loop-local in `useThreeScene.js`.

#### Phase 1 — Tunnel & Portal Depth Field [Shipped]

- Added internal uniforms `uTunnelA` (`vec4`: x=depth, y=inward, z=gills, w=spiral) and `uTunnelB` (`vec4`: x=breath, y=portalBloom) to `psychedelic.frag` and `mainUniforms` in `useThreeScene.js`.
- Added helpers: `tunnelCoords`, `gillRidges`, `tunnelLayer`, `portalBloom` in `psychedelic.frag`.
- `tunnelCoords` applies spiral twist as a pre-polar UV rotation (not as an angular depth term) to eliminate the `atan` branch-cut seam on the left side of the canvas. Spiral angle: `spinAngle = spiral * length(p) * 0.40 + t * spiral * 0.10`.
- `gillRidges` uses integer sector counts so `sin(theta * N)` is continuous across the branch cut.
- Tunnel layer composited **behind** the blob using the miss-ray / SDF hit test; reuses Stage 1's warped `fieldUV`, no second domain warp.
- Atmosphere clamp lifted from hard 0.035 to journey-modulated: `clamp(atmosphereMask, 0.0, 0.035 + atmosphereDensity * 0.06)` — peak ~0.095, silence-gated.
- `cellularEdge` extended into tunnel/atmosphere region at ≤ 30% surface intensity as off-body mycelium hint, gated by `audioPresence` and `surfaceDetail`.
- Blob `exposure` floor dropped 0.52 → 0.46 to reduce blob dominance.
- Per-mode tunnel character via existing `uEngineA/B/C/D` + `uModeBlend`: Fluid = soft drift; Radial = high gill density; Vortex = high spiral + tight inward pull; Collapse = strong breath + periodic contraction; Orbit = seam-aligned co-rotation.
- Visibility tuning: `tunnelGain` raised from `0.18 + tunDepth * 0.42` to `0.30 + tunDepth * 0.52`; `tunnelIdleFloor = 0.28 + calmMotion * 0.14` added so concentric rings breathe visibly at silence (floor ranges 0.28–0.42).
- Seam fix verified: `atan` branch-cut discontinuity confirmed absent in Puppeteer capture.
- Files touched: `src/shaders/psychedelic.frag`, `src/hooks/useThreeScene.js`, `PLAN.md`.

#### Focused Fungal Visual Refinement [Shipped]

- Reduced blob dominance by lowering the SDF base radius to `0.66`, reducing core/bass expansion and camera close-pull, and lowering the surface diffuse floor.
- Added cheap cap/stem anisotropic shaping in the existing SDF, stronger 12-sector gill displacement, surface gill shading, and higher-but-capped surface/off-body mycelium visibility.
- Amplified the existing tunnel layer with secondary membrane ribs, spiral depth ribs, wider portal bloom, stronger tunnel compositing, and more silhouette-edge bleed.
- Added low-energy cool material bias and local surface material zones so calm/build/afterglow read blue-violet/cyan while peak keeps structured magenta/cyan bloom.
- Files touched: `src/shaders/psychedelic.frag`, `src/hooks/useThreeScene.js`, `src/shaders/particle.vert`, `PLAN.md`.

#### Phase 2 — Particle Ecosystem Refinement [Shipped]

Goal: convert CPU particles into true spore/pollen/dust strata with parallax orbits, mode-coupled corridors, and onset bloom. Touches `src/hooks/useThreeScene.js` particle update and `src/shaders/particle.vert`.

- Near/mid/far depth strata via size + opacity + parallax, not extra geometry.
- Silence: suspended drift, near-zero acceleration.
- Bass: subtle outward pressure. Mids: curling flow. Highs: shimmer/flicker/detail.
- Slow currents; no symmetrical orbits, no starfield jitter, no explosion bursts.
- Mode targets:
  - Fluid: tunnel rim drift and tissue-like curl.
  - Radial: mandala arcs and breathing folds.
  - Vortex: tangential bloom bursts.
  - Collapse: inward mycelium branches with controlled release on onset.
  - Orbit: stable orbital seams and seam-biased shimmer.
- Particle shader size/opacity cohesion was lightly tuned in the focused refinement. Remaining work is deeper motion/strata behavior only; keep `MAX_PARTICLES = 128`.
- Phase 2 follow-up shipped depth-stratified CPU particle spawning and motion: far dust, mid spores, near embers/pollen, mode-coupled corridors, sustained active-audio spore trickle, silence-damped acceleration, and capped shader size/opacity cohesion. No new buffers, uniforms, render targets, render passes, store keys, URL keys, controls, mode IDs, or dependencies were added.

#### Living Portal / Structured Psychedelic Color Upgrade [Shipped]

- Reused the existing fBM/domain-warp, cellular-edge, polar tunnel, curl-like CPU particle, and cosine palette systems; no Shadertoy code, DataTexture, new pass, or new target was added.
- Reserved `uTunnelB.zw` now carry render-loop-local growth-wave age/amplitude. Onset/mid pulses launch a travelling membrane wave that opens gills, pushes local color heat, clears trail slightly through existing decay tuning, and releases rim/tunnel spores.
- Palette behavior is layered: slow global drift, organism/tunnel offsets, localized shimmer speed on gills/spores/edges, afterglow slowdown, and peak complementary contrast without full-frame hue cycling.
- Material zones now separate violet organism flesh, indigo folds, cyan/teal tunnel depth, black-green/blue negative space, gold/yellow/acid gill and portal accents, cyan/violet atmosphere, and phase-aware spore colors.
- Particle follow-up uses existing `aType`/`aDepth` only: growth-wave rim spores, build-phase tunnel spores, treble shimmer motes, and type/depth color zoning in `particle.vert`.

#### Phase 3 — Atmosphere & Mycelium Extension [Shipped as focused tuning pass]

Goal: lift the atmosphere envelope further, extend cellular veins into background space as a mycelium hint, soften blob silhouette dominance.

- Focused refinement extended off-body mycelium through the existing cellular/tunnel masks, increased edge erosion/fog blending, and preserved trail behavior because the current trail pass did not fight the composition in verification.

#### Phase 4 — Trail Polish [Conditional, Unshipped]

Only activate if Phases 1–3 introduce visible muddiness in the trail buffer. The current trail is already refined (directional smear, luminance-aware decay, chromatic shear, orphan crushing). Do not touch `trail.frag` pre-emptively.

- If the tunnel layer accumulates ghosting in the trail: verify composition order (tunnel composites pre-trail), reduce tunnel gain constants first, then consider a minor `uDecay` floor reduction.
- Stay within existing `uDecay` range 0.70–0.94.

#### Phase 5 — Mode Journey Logic [Partially Shipped; follow-up]

Goal: make Fluid and Vortex feel structurally distinct, not just palette tweaks — extend Stage 4 engine weights so each mode shifts the tunnel logic, not just the SDF warp. Slice 6 shipped the named journey phase system and phase multipliers; remaining work is only further per-mode structural contrast if future QA says Fluid/Vortex still blur together.

- Fluid (0): deeper idle tunnel drift, tidal breathing at sub-band, low chaos floor.
- Vortex (2): strong spiral bias in `tunnelCoords`, mid-driven tightening inward pull, high `spectralFlux` sensitivity.
- Confirm by visual comparison against Radial/Collapse/Orbit which already have structural signatures.

## Implementation Preference

Prioritize atmosphere (Stage 2), surface detail (Stage 3), and coordinated particles (Stage 6 refinement), then the mode engines + journey state model (Stage 4) and the trail upgrade (Stage 5) before attempting any reaction-diffusion work (Stage 8). Stage 8 should remain optional, isolated, performance-safe, and ideally behind a flag or preset. Stage 9 comes last.

## First Executable Slice

- Status: completed and superseded by the verified shader/trail/particle passes logged in `PLAN.md`.
- Run Stage 0 first: read required context, confirm worktree state, and run baseline checks.
- If baseline is clean, execute Stage 1 only as the first implementation slice.
- Stage 1 should primarily touch `src/shaders/psychedelic.frag`; avoid `useThreeScene.js`, `trail.frag`, particles, `DataTexture`, or new uniforms unless a compile issue makes a tiny supporting edit unavoidable.
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
- `audioPresence` (Stage 4 derived, render-loop local): smoothed envelope of overall audio activity; gates `onset` accents and lifts atmosphere/particle activity.
- Bass-band still owns body/pressure; mids own morphology/flow; highs own shimmer/detail. No single band may cause chaotic global motion on its own; coordination flows through Stage 4 derived controls.

## QA And Acceptance

- Required after each implementation checkpoint: `npm run lint`, `npm run build`, and `git diff --check`.
- Visual QA: no audio, quiet audio, bass-heavy audio, treble-heavy audio, transient-heavy audio, all five modes, drag force, UI click isolation, fullscreen with `H`, and no shader compile errors.
- Capture calm, mid, and peak screenshots when tuning visual feel.
- Performance acceptance: no obvious desktop frame collapse; if a feature causes instability, reduce or disable it with the planned internal constants and keep stable work.
- Regression acceptance: audio data still bypasses React state, particles render last, trail ping-pong never samples and writes the same target, and palette family transitions still pass through `uPaletteFamilyBlend`.
- Visual acceptance: the scene feels more alive and layered for 30-60 seconds, bass/mids/highs produce distinct behavior, silence is stable, particles feel field-coupled, and the trail feels like biological memory.
- Stabilization regressions are blocking: no return of the stroke-like glow border, no abrupt slider/mode pop, no silent-state runaway motion, no spurious distortion impulses, no trail ghost clash.
- Silence test (30-60s, no audio): the scene should feel dormant/breathing, not crawling.
- Wake test: introducing audio should gradually escalate through Awakening -> Blooming without any single band triggering chaotic global motion.
- UI readability: ControlPanel and EnergyIndicator remain clearly readable through any new atmosphere/depth layer.

## Assumptions

- This file is the canonical fresh-session prompt for the visual expansion.
- The immediate pass is Stages 2-6 (atmosphere, cellular/vein, mode engines + journey state, trail, and the particle ecosystem refinement on top of the shipped cohesion baseline).
- Stage 7 audio texture work is optional and should wait for stable QA from Stages 1-6.
- Stages 8 and 9 are optional and gated; Stage 10 is research-only.
- No new dependencies, UI controls, backend, render targets, render passes, GPU particles, full fluid sim, or true reaction-diffusion will be added without explicit architecture approval.
- Future implementers should append one dated `✅` implementation-ledger line to `PLAN.md` after any verified visual-expansion implementation slice.
