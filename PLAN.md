# PLAN.md

Created by: Codex
Role: execution guardrail, boundary map, and implementation ledger
Date: 2026-05-09

This file is intentionally Codex-shaped: compact tables, direct operating rules, and implementation status language. It is not a Claude architecture document and must not replace `CLAUDE.md`, `ARCHITECTURE.md`, or a future `CONTRACT.md`.

## Current System Structure

| Zone | Current responsibility | Primary files |
|---|---|---|
| App shell | Starts the experience, owns fullscreen state, UI-hidden state, recording cursor behavior, and top-level overlays. | `src/App.jsx` |
| Canvas mount | Keeps the WebGL canvas mounted and wires render/audio hooks. | `src/components/VisualCanvas.jsx` |
| State | Stores UI controls, audio snapshots, behavioral state, discoveries, recording state, and presets. | `src/store/useStore.js` |
| Audio | Creates one analyser path, extracts sub/bass/mid/hi bands, writes audio data through `useStore.getState()`. | `src/audio/*`, `src/hooks/useAudioAnalyser.js` |
| Render loop | Owns Three.js setup, uniforms, force field, particles, gestures, and per-frame animation. | `src/hooks/useThreeScene.js`, `src/three/*` |
| Shaders | Main SDF/FBM visual, trail feedback, and particle rendering. | `src/shaders/*` |
| Gestures | Ring-buffer detectors and click timing for discrete gesture discovery. | `src/utils/gestures.js` |
| UI overlays | Controls, presets, sharing, recording, energy indicator, discovery toast, landing/audio input. | `src/components/*` |
| Persistence/share | URL serialization plus preset encoding/mutation/storage. | `src/utils/shareUtils.js`, `src/utils/presetUtils.js`, `src/hooks/useURLState.js` |

Reference materials inspected:

| Asset | Role |
|---|---|
| `screenshots/Reference_1.png` | Organic surface / clustered depth reference. |
| `screenshots/Reference_2.png` | Dense flowing-line texture reference. |
| `screenshots/Reference_3.png` | Neon spiral / tunnel motion reference. |
| `screenshots/calm.png`, `screenshots/mid.png`, `screenshots/peak.png` | Existing capture states for visual comparison. |
| `src/assets/hero.png` | Existing app image asset. |

## NON-NEGOTIABLE Decisions

These decisions are locked. Do not reinterpret them during fixes, tuning, cleanup, or future feature work.

| Decision | Locked rule |
|---|---|
| Gestures | **NON-NEGOTIABLE:** Gestures are drag-only. There is no idle gesture. `circle`, `figure-8`, and `rapid-click` remain. |
| `uMouse` | **NON-NEGOTIABLE:** `uMouse` only steers while pressed and lerps back to `(0,0)` on release. |
| Fullscreen UI | **NON-NEGOTIABLE:** Fullscreen hides interactive UI. The `H` key can toggle overlays without exiting fullscreen. |

## UNIMPLEMENTED ARCHITECTURE - DO NOT TOUCH

The locked decisions above are part of a pending structural redesign from a future Claude session. They are not a license for Codex to pre-emptively rebuild the system.

Do not modify, optimize around, or partially redesign these areas unless the active task explicitly authorizes implementation:

| Future decision | Current handling rule |
|---|---|
| Gesture system -> drag-only mode, idle removed | Document and protect the target behavior. Do not invent a new gesture framework. |
| `uMouse` -> active only while pressed, returns to `(0,0)` | Preserve the intended contract. Do not move steering ownership out of the current render/input path. |
| Fullscreen -> hides UI, `H` toggles overlays | Keep fullscreen visibility behavior in the existing app/UI ownership zones. |

## Protected Zones

| Zone | Boundary | Modification rule |
|---|---|---|
| Input routing | Mouse, touch, click, hold, drag, and gesture calls in `useThreeScene.js` and `utils/gestures.js`. | Keep input ownership local. Do not split into new systems or add alternate control layers. |
| Gesture contract | Gesture output is discrete discovery/action events only: `circle`, `figure-8`, `rapid-click`. | Do not add continuous idle gesture behavior. Do not make gestures drive persistent global state. |
| `uMouse` contract | Shader receives a normalized steering vector. Future locked behavior requires press-only steering and return-to-center. | Do not let hover-only movement become steering intent. |
| UI visibility | `App.jsx` coordinates fullscreen, recording, hidden overlays, and the `H` key. Components receive `isHidden`. | Do not create separate visibility authorities in child components. |
| Render pipeline | Main shader -> trail blend -> screen -> particles. Ping-pong render targets stay separate. | Do not merge passes, reorder particles into the trail, or replace the renderer. |
| Audio flow | Web Audio analyser -> band extraction -> Zustand via `getState()` -> render loop reads via `getState()`. | Do not put high-frequency audio data through React render state. |
| Shader contracts | Existing uniforms, mode IDs, force arrays, palette family, and trail decay semantics. | Tune inside the current uniform/shader model. Do not add a new rendering architecture. |
| Safe mode continuity | Mode buttons/store IDs remain discrete; only render-loop-local visual state smooths transitions. | Keep smoothing in `useThreeScene.js` and shader uniforms. Do not move this into UI, Zustand, gestures, or fullscreen ownership. |

## Safe Areas For Iteration

| Area | Allowed work |
|---|---|
| Visual coherence | Tune smoothing, interpolation, palette balance, trail decay bounds, force strengths, and shader constants inside existing files. |
| Audio responsiveness | Improve band smoothing, transient response, silence stability, and perceived beat anticipation without replacing Web Audio flow. |
| Mode transitions | Add interpolation or state preservation inside the existing render loop/control path so modes do not snap or reset visually. |
| Presets | Fix mutation behavior so mutate only affects intended parameters and does not unexpectedly force or change mode. |
| UI layout | Resolve overlay collisions, improve spacing, and add missing controls within existing component structure. |
| Edge effects | Remove or reduce unwanted full-page glow/border behavior without introducing a new visual layer. |
| Documentation | Update Codex-owned execution notes when implementation status changes. |

## Codex Execution Backlog

| Priority | Task | Success condition | Status |
|---|---|---|---|
| High | Visual expansion shader/trail/particle pass | Canonical phased plan at `.claude/plans/psychedelic-playground-visual-expansion-master.md` guided the additive shader, trail, and CPU-particle pass while preserving current architecture. | Implemented |
| High | Audio-to-motion responsiveness and silence stability | Visual response feels predictive and stable; low volume does not jitter. | Implemented |
| High | Smooth mode transitions | Switching modes evolves from the current visual state without snap/reset behavior. | Implemented |
| High | Mutation coupling bug | `Mutate` does not force Fluid mode or alter mode except by an explicitly intended rule. | Implemented |
| Medium | Share/record layout collision | Share and record controls no longer overlap. | Implemented |
| Medium | Reset to default | A clear reset-to-default control exists without changing source-selection behavior. | Implemented |
| Medium | Full-page glow border | Unwanted full-page edge glow/border effect is removed or constrained. | Implemented |

## Rules For Future Modifications

1. Preserve folder structure, file names, module boundaries, and ownership.
2. Do not introduce frameworks, replacement renderers, replacement input systems, or replacement audio pipelines.
3. Keep changes local, reversible, and compatible with the current control/data flow.
4. Prefer constants, interpolation, guards, and small helper functions over new architecture.
5. If a fix requires moving responsibilities between files or redefining system ownership, stop and request explicit approval.
6. Keep high-frequency audio and render-loop data out of React component render state.
7. Keep shader edits inside existing shader files and uniforms unless a new uniform is strictly necessary.
8. Treat Claude-authored architecture docs as source-of-design truth; treat this file as Codex execution guidance.
9. Any structural redesign requires explicit approval before implementation.

## Implementation Ledger

| Date | Change | Files | Verification |
|---|---|---|---|
| 2026-05-12 | ✅ Implemented Stage 3 Cellular And Vein Layer with one lightweight 3x3 cellular-edge helper and a low-amplitude, silence-gated internal surface detail layer inside the main shader only, preserving uniforms, controls, mode IDs, trail, particles, render targets, and render order. | `src/shaders/psychedelic.frag`, `PLAN.md` | `npm run lint`, `npm run build`, `git diff --check`, Puppeteer 30s silent/calm and fake-mic mode-cycle screenshots at `http://127.0.0.1:5187/` — no page errors, no hard outline glow, no full-frame haze wash, no silent crawling observed; UI remained readable. |
| 2026-05-12 | ✅ Implemented Stage 2 Organic Atmosphere And Depth Layer with low-amplitude vapor, depth haze, and proximity mist inside the main shader only, preserving uniforms, render targets, trail, particles, mode IDs, controls, URLs, and preset contracts. | `src/shaders/psychedelic.frag`, `PLAN.md` | `npm run lint`, `npm run build`, `git diff --check`, Puppeteer silent + fake-mic mode-cycle screenshots at `http://127.0.0.1:5184/` — no app console/page errors, no hard outline glow or trail clash observed. |
| 2026-05-12 | ✅ Implemented Stabilization Pass S6 unified journey/intensity model: added `journey` accumulator (sustained + transient) in `useThreeScene.js` render loop, blended into `uEnergy`, trail `bassClear`, trail `uFlow`, particle `spawnRate` (via `journeyGate`), and `setEnergySnapshot` — no uniforms, controls, URLs, presets, mode IDs, render order, or file changes beyond `useThreeScene.js`. | `src/hooks/useThreeScene.js`, `VISUAL_STABILIZATION_TRACK.md`, `PLAN.md` | `npm run lint`, `npm run build`, `git diff --check`, Puppeteer silent + mode 0–4 cycle + rapid 0↔3 switch — zero page errors, canvas alive. |
| 2026-05-12 | ✅ Implemented Stabilization Pass S5 particle ecosystem refinement with capacity-aware spawn throttling, calmer idle dust, bounded collision bursts, dt-based particle aging, and softer particle shader alpha/size falloff while preserving the existing CPU particle architecture. | `src/hooks/useThreeScene.js`, `src/shaders/particle.vert`, `VISUAL_STABILIZATION_TRACK.md`, `PLAN.md` | `npm run lint`, `npm run build`, `git diff --check`, Puppeteer captures at `http://127.0.0.1:5186/` across silent/modes 0-4 plus uploaded WAV smoke for Vortex→Orbit→Collapse with no console/page errors. |
| 2026-05-12 | ✅ Installed Puppeteer and made it the default Codex browser screenshot workflow for local HTML inspection/visual comparison. | `package.json`, `package-lock.json`, `scripts/puppeteer-screenshot.mjs`, `AGENTS.md`, `.claude/rules/shaders.md`, `PLAN.md` | `npm install --save-dev puppeteer`, `npm run lint`, `npm run build`, `git diff --check`, Puppeteer smoke capture at `http://127.0.0.1:5184/`. |
| 2026-05-12 | ✅ Added the CPU particle cohesion pass: mode-specific spore/spark/droplet spawning, render-loop audio/silence gated particle motion, field-coupled curl/tangent/radial drift, and particle shader size/alpha tuning from derived audio uniforms. | `src/hooks/useThreeScene.js`, `src/shaders/particle.vert`, `PLAN.md`, `.claude/docs/progress.md`, `.claude/plans/psychedelic-playground-visual-expansion-master.md` | `npm run lint`, `npm run build`, screenshot-based Chrome smoke at `http://127.0.0.1:5175/` across modes 0-4, `git diff --check`. |
| 2026-05-12 | ✅ Added the psychedelic shader expansion pass with render-loop-derived audio uniforms, polar fold/spiral helpers, mode-weighted kaleidoscope/torsion shaping, orbit-trap filaments, controlled palette temperature/exposure, and subtle trail chromatic shear. | `src/hooks/useThreeScene.js`, `src/shaders/psychedelic.frag`, `src/shaders/trail.frag`, `PLAN.md` | `npm run lint`, `npm run build`, headless Chrome smoke at `http://127.0.0.1:5175/` across modes 0-4, `git diff --check`. |
| 2026-05-11 | ✅ Implemented Phase 1 main-shader organic field expansion with shared warped coordinates, conservative FBM/domain warp helpers, subtle kaleido folding, and reused field coordinates across camera shaping, fog, background texture, procedural detail, and filaments. | `src/shaders/psychedelic.frag`, `PLAN.md` | `npm run lint`, `npm run build`, `git diff --check`, Chrome headless smoke at `http://127.0.0.1:5183/`. |
| 2026-05-11 | ✅ Audited and tightened the visual expansion docs so the master plan is self-contained, non-duplicative, and ready for a Phase 0/Phase 1 fresh session. | `.claude/plans/psychedelic-playground-visual-expansion-master.md`, `.claude/docs/progress.md`, `PLAN.md` | `git diff --check`; no trailing whitespace; path/phase/reference checks. |
| 2026-05-11 | ✅ Created the canonical visual expansion master plan and linked the backlog/progress trackers for future execution. | `.claude/plans/psychedelic-playground-visual-expansion-master.md`, `PLAN.md`, `.claude/docs/progress.md` | `git diff --check`; path/reference checks. |
| 2026-05-11 | ✅ Implemented the research-to-implementation visual field pass: perceptual audio bands/pulses/RMS/silence, shared audio uniforms, conservative shader/trail/particle coupling, drag-only pointer routing, stricter hidden fullscreen UI, and guarded URL sync against high-frequency store churn. | `src/audio/bands.js`, `src/hooks/useAudioAnalyser.js`, `src/store/useStore.js`, `src/behaviors/BehavioralController.js`, `src/hooks/useThreeScene.js`, `src/hooks/useURLState.js`, `src/shaders/*`, `src/components/VisualCanvas.jsx`, `src/App.jsx` | `npm run lint`, `npm run build`, local Vite smoke at `http://127.0.0.1:5182/`, `git diff --check`. |
| 2026-05-11 | ✅ Replaced README boilerplate, archived stale root planning docs, rewrote the MVP plan as current architecture/product truth, refreshed progress status, and aligned add-control/shader/audio docs. | `README.md`, `.claude/archive/*`, `.claude/plans/psychedelic-playground-mvp.md`, `.claude/docs/progress.md`, `.claude/skills/add-control/SKILL.md`, `.claude/agents/shader-tuner.md`, `.claude/rules/audio.md`, `AGENTS.md` | Markdown conflict scan, Markdown inventory, `git diff --check`. |
| 2026-05-11 | ✅ Added spectral FFT features, shareable trail/camera/procedural/particle controls, flux-driven shader texture, particle density tuning, preset/default backfill, and docs consolidation around `.claude`. | `src/audio/bands.js`, `src/hooks/useAudioAnalyser.js`, `src/hooks/useThreeScene.js`, `src/shaders/psychedelic.frag`, `src/shaders/particle.vert`, `src/store/useStore.js`, `src/components/ControlPanel.jsx`, `src/utils/shareUtils.js`, `src/utils/presetUtils.js`, `AGENTS.md`, `CLAUDE.md`, `.claude/*` | `npm run lint`, `npm run build`, `git diff --check`, Chrome headless smoke at `http://127.0.0.1:5175/` passed. |
| 2026-05-09 | Safe Mode Continuity Fix: dt-based local mode transition easing, smoothed `uPaletteFamilyBlend`, stronger transition trail hold, and probabilistic previous/current particle spawn styles. Deferred interaction/fullscreen/Zustand refactor remains unimplemented. | `src/hooks/useThreeScene.js`, `src/shaders/psychedelic.frag`, `src/shaders/particle.vert` | `npm run build`, `npm run lint`, `git diff --check` passed. |

## Verification Checklist

| Check | Expected result |
|---|---|
| File placement | `PLAN.md` exists at the project root beside `README.md` and `CLAUDE.md`. |
| Ownership | The file clearly says `Created by: Codex`. |
| Locked decisions | All three **NON-NEGOTIABLE** decisions are present and easy to find. |
| Scope | No application source, shader, asset, config, or existing Markdown file is changed by creating this file. |
| Role | The file reads as an execution guardrail and backlog, not a replacement architecture spec. |
