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
| 2026-05-09 | Safe Mode Continuity Fix: dt-based local mode transition easing, smoothed `uPaletteFamilyBlend`, stronger transition trail hold, and probabilistic previous/current particle spawn styles. Deferred interaction/fullscreen/Zustand refactor remains unimplemented. | `src/hooks/useThreeScene.js`, `src/shaders/psychedelic.frag`, `src/shaders/particle.vert` | `npm run build`, `npm run lint`, `git diff --check` passed. |

## Verification Checklist

| Check | Expected result |
|---|---|
| File placement | `PLAN.md` exists at the project root beside `README.md` and `CLAUDE.md`. |
| Ownership | The file clearly says `Created by: Codex`. |
| Locked decisions | All three **NON-NEGOTIABLE** decisions are present and easy to find. |
| Scope | No application source, shader, asset, config, or existing Markdown file is changed by creating this file. |
| Role | The file reads as an execution guardrail and backlog, not a replacement architecture spec. |
