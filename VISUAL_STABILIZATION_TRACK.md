# Visual Stabilization Track

This document is separate from the main implementation roadmap.
It does not replace `PLAN.md`, `.claude/plans/*`, or any existing project phases.

All work in this track must use the labels `Stabilization Pass S0/S1/S2...`.

No visual implementation happens from this document alone. If any stabilization change conflicts with existing plans or repo guardrails, report the conflict and ask before modifying code.

Current audit found no blocking conflict as long as this track preserves:

- existing render order: main -> trail blend -> screen -> particles last
- existing Zustand/audio flow
- existing mode IDs
- existing URL/preset schema
- existing shader uniform contracts
- existing particle architecture

## Audit Map

Main blob shader:

- `src/shaders/psychedelic.frag`
- Key areas: `sdfBlob`, `sdfOrbit`, normal estimation, raymarch/color composition, procedural mask, exposure, vignette.

Glow, bloom, rim, edge, and SDF masking:

- `src/shaders/psychedelic.frag`: near-miss glow, proximity glow, energy filaments, shimmer, exposure.
- `src/shaders/trail.frag`: trail blend, edge/chroma shear.
- `src/shaders/particle.frag`: particle core/bloom alpha.
- `src/components/EnergyIndicator.jsx`: UI glow/vignette only.

UI sliders, modes, Zustand, and uniforms:

- `src/store/useStore.js`: control defaults/actions/presets.
- `src/components/ControlPanel.jsx`: sliders and mode buttons.
- `src/utils/shareUtils.js`: URL serialization/ranges.
- `src/hooks/useURLState.js`: URL hydration/sync.
- `src/hooks/useThreeScene.js`: render-loop store reads, smoothing, uniform writes.

Audio feature path:

- `src/audio/bands.js`: FFT bands, RMS, silence, centroid, flux.
- `src/hooks/useAudioAnalyser.js`: analyser loop, smoothing, pulses, beat/energy envelope.
- `src/behaviors/BehavioralController.js`: calm/build/peak/afterglow state.
- `src/hooks/useThreeScene.js`: audio curves, shader/particle/trail mapping.

Particle behavior:

- `src/hooks/useThreeScene.js`: particle buffers, `spawnParticle`, `spawnParticleForMode`, update/render loop.
- `src/shaders/particle.vert`
- `src/shaders/particle.frag`

Render passes, trail, bloom/postprocessing:

- `src/hooks/useThreeScene.js`: renderer, render targets, main/trail/final passes, particles last.
- `src/three/renderTargets.js`
- No EffectComposer or external bloom stack is currently present.

Existing plan guardrails:

- `PLAN.md` and `.claude/plans/psychedelic-playground-visual-expansion-master.md` allow conservative visual coherence work.
- They forbid unapproved new dependencies, render passes, render targets, public controls, URL keys, preset schema changes, mode IDs, GPU particles, or broad renderer replacement.

## Stabilization Pass S0 - Orientation / Repo Audit

Likely touched:

- `VISUAL_STABILIZATION_TRACK.md` only.

Exact areas to inspect:

- `PLAN.md`
- `.claude/plans/psychedelic-playground-visual-expansion-master.md`
- `.claude/plans/psychedelic-playground-mvp.md`
- `.claude/rules/shaders.md`
- `.claude/rules/render-pipeline.md`
- `.claude/rules/audio.md`
- `.claude/rules/state.md`
- `src/hooks/useThreeScene.js`
- `src/shaders/psychedelic.frag`

Implementation approach:

- Add the standalone track document.
- Record audit findings, constraints, and S-pass sequence.
- Do not alter, reorder, merge, or reinterpret existing phases.
- Capture baseline visual references before future shader changes.

Risks:

- Plan confusion with existing repo phases.
- Accidentally turning this into a replacement roadmap.

Visual verification:

- Baseline screenshots cover silent, calm, mid, peak, mode switching, and particle-heavy states.

## Stabilization Pass S1 - Blob Edge / Glow Cleanup

Likely touched:

- `src/shaders/psychedelic.frag`
- possibly `src/shaders/trail.frag`
- possibly `src/shaders/particle.frag`

Exact areas to inspect:

- `sdfBlob`
- `sdfOrbit`
- normal estimation
- near-miss glow
- proximity glow
- procedural mask
- energy filaments
- shimmer/exposure/vignette
- trail edge/chroma shear

Implementation approach:

- Tune existing shader constants and masks.
- Reduce harsh rim clipping, full-frame glow wash, and uncontrolled bloom-like brightness.
- Keep brightness localized around blob structure and intentional accents.
- Do not add EffectComposer, bloom libraries, render targets, or new public controls.

Risks:

- Over-dimming the scene.
- Losing neon identity.
- Introducing GLSL precision or int/float uniform mistakes.

Visual verification:

- Blob silhouette is readable in calm and peak states.
- Bass hits do not create full-frame white flashes.
- Background stays alive without overpowering the blob.

## Stabilization Pass S2 - Control And Mode Smoothing

Likely touched:

- `src/hooks/useThreeScene.js`
- possibly `src/components/ControlPanel.jsx`
- possibly `src/store/useStore.js`

Exact areas to inspect:

- render-loop store reads
- smoothed mode state
- palette family blend
- slider `setControl` calls
- control defaults and preset application

Implementation approach:

- Keep UI and Zustand values immediate.
- Smooth visual response locally in `useThreeScene.js`.
- Preserve mode IDs, URL params, preset shape, and `uPaletteFamilyBlend`.
- Reduce abrupt visual snaps from rapid slider or mode changes.

Risks:

- Moving 60fps visual smoothing into React state.
- Making controls feel delayed.
- Breaking shared URLs or presets.

Visual verification:

- Rapid mode switching has no palette flash.
- Slider sweeps feel responsive but fluid.
- Saved presets and shared URLs still restore identical control values.

## Stabilization Pass S3 - Silence / Idle Breathing

Likely touched:

- `src/hooks/useThreeScene.js`
- `src/hooks/useAudioAnalyser.js`
- `src/audio/bands.js`
- `src/behaviors/BehavioralController.js`
- possibly `src/shaders/psychedelic.frag`

Exact areas to inspect:

- silence detection
- RMS and spectral flux smoothing
- adaptive pulse logic
- calm/build/peak/afterglow transitions
- idle camera drift
- turbulence/shimmer decay
- particle spawn under low energy

Implementation approach:

- Stabilize quiet-state thresholds and decay.
- Use existing uniforms/render-loop state for subtle idle breathing.
- Reduce flicker, shimmer, and particle jitter during silence.
- Preserve audio writes through `useStore.getState().setAudioData(...)`.

Risks:

- Making silence visually dead.
- Mistaking quiet music for silence.
- Flattening low-energy passages.

Visual verification:

- No audio produces slow, subtle breathing.
- Quiet audio does not flicker.
- Re-entering audio ramps smoothly.

## Stabilization Pass S4 - Reduce Kaleidoscopic Symmetry

Likely touched:

- `src/shaders/psychedelic.frag`
- possibly `src/hooks/useThreeScene.js`

Exact areas to inspect:

- domain warp
- fold/radial/orbit shaping
- mode bias
- field detail
- SDF perturbation
- audio/mouse asymmetry inputs

Implementation approach:

- Reduce repeated mirrored/radial symmetry where it is not mode-defining.
- Add organic asymmetry through existing time, audio, field detail, and mouse inputs.
- Preserve all five current modes and their identities.
- Do not add new modes or public controls.

Risks:

- Weakening the psychedelic character.
- Making modes less distinct.
- Creating unstable SDF artifacts.

Visual verification:

- Forms feel organic rather than locked into a mandala.
- Radial/orbit modes still feel intentional.
- Calm, mid, and peak states remain smooth.

## Stabilization Pass S5 - Particle Ecosystem Refinement

Likely touched:

- `src/hooks/useThreeScene.js`
- `src/shaders/particle.vert`
- `src/shaders/particle.frag`

Exact areas to inspect:

- `MAX_PARTICLES`
- particle buffers/material
- `spawnParticle`
- `spawnParticleForMode`
- per-frame particle update
- particle alpha, size, velocity, color, lifetime

Implementation approach:

- Tune existing CPU particle behavior.
- Refine spawn rate, lifetime, velocity, alpha, and size.
- Keep particles rendered last with `autoClear=false`.
- Keep current particle count and architecture unless separately approved.

Risks:

- Overdraw and performance loss.
- Visual clutter during peaks.
- Particles obscuring the blob silhouette.

Visual verification:

- Calm state has sparse, intentional motion.
- Peak state feels active without covering the blob.
- Particles remain correctly layered over the trail output.

## Stabilization Pass S6 - Unified Journey / Intensity Model

Likely touched:

- `src/hooks/useThreeScene.js`
- `src/behaviors/BehavioralController.js`
- possibly `src/hooks/useAudioAnalyser.js`
- possibly `src/components/EnergyIndicator.jsx`

Exact areas to inspect:

- analyser-derived energy
- behavioral controller state
- shader uniform intensity mapping
- trail decay mapping
- particle density mapping
- energy UI state

Implementation approach:

- Consolidate existing internal derived intensity signals.
- Coordinate blob motion, glow, trail, particles, and energy UI around one coherent journey.
- Preserve public controls, Zustand state shape, URLs, presets, and uniforms unless explicitly approved.

Risks:

- Regressing audio responsiveness.
- Making all modes feel similar.
- Accidentally changing saved/shared behavior.

Visual verification:

- Calm, build, peak, and afterglow feel connected.
- Intensity changes affect blob, glow, trail, and particles coherently.
- Energy UI matches visible behavior.

## Stabilization Pass X1 - Future Visual Expansion Research

Likely touched:

- planning docs only unless separately approved.

Exact areas to inspect:

- `.claude/plans/psychedelic-playground-visual-expansion-master.md`
- deferred trail edge-growth ideas
- deferred audio DataTexture ideas
- render pipeline constraints

Implementation approach:

- Research only after S0-S6 are stable.
- Do not implement expansion work in this pass.
- Any new dependency, render pass, render target, shader interface, mode, URL key, or control requires approval.

Risks:

- Expanding scope before stabilization is complete.
- Violating established render-pipeline constraints.

Visual verification:

- None until a future implementation plan is approved.

## Public Interfaces And Contracts

- Add one new planning file by default: `VISUAL_STABILIZATION_TRACK.md`.
- Do not rename, reorder, merge, or reinterpret existing project phases.
- Do not change mode IDs, URL keys, preset schema, Zustand state shape, shader uniform types, or render-pass order during stabilization unless explicitly approved.
- Preserve audio flow: analyser writes via `useStore.getState().setAudioData(...)`; render loop reads via `useStore.getState()`.
- Preserve render order: main pass -> trail blend -> screen -> particles last.
- Keep mode continuity local to the render loop.

## Test And Visual QA

For each future implementation pass:

- Run `npm run lint`.
- Run `npm run build`.
- Run `git diff --check`.
- Visually inspect silent, calm, mid-energy, peak, rapid mode switching, rapid slider movement, mouse interaction, fullscreen, hidden UI, and particle-heavy states.
- Confirm no shader compile errors, blank canvas, full-frame flashes, broken trail ping-pong, or particle layering regressions.

## Assumptions

- The merged plan lives at repo root as `VISUAL_STABILIZATION_TRACK.md`.
- The root location is chosen because it is visible beside `PLAN.md` while clearly not replacing it.
- If a root `plans/` folder is introduced later, moving this file requires explicit approval.
- Implementation remains blocked until the user explicitly requests a specific `Stabilization Pass S#`.

## Stabilization Ledger

| Date | Change |
|---|---|
| 2026-05-12 | ✅ Stabilization Pass S1.2 removed the calm-mode blob border by calm-gating outer edge glow, replacing rim contrast with soft surface fill, broadening proximity haze, and reducing trail silhouette stacking without changing render order, controls, uniforms, URLs, presets, or particles. |
| 2026-05-12 | ✅ Stabilization Pass S1.1 softened blob border transition by feathering main-shader surface/near-miss masks and dampening trail edge shear without changing render order, controls, uniforms, URLs, presets, or particles. |
| 2026-05-12 | ✅ Stabilization Pass S1 tuned blob edge/glow brightness masks in the main shader without changing render order, controls, URLs, presets, or particle architecture. |
| 2026-05-12 | ✅ Stabilization Pass S0 planning document created as a separate visual stabilization track. |
