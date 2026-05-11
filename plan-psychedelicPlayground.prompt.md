## Current Codebase Summary

- `src/` is a small, well-scoped React + Vite app with a Three.js fullscreen quad, raw GLSL shaders loaded via `?raw`, and a strict three-pass render pipeline: main visual → trail accumulation → particles.
- Audio is handled in `src/hooks/useAudioAnalyser.js` + `src/audio/bands.js`; `AnalyserNode` FFT data is converted into bands, smoothed, and written directly to Zustand with `useStore.getState().setAudioData(...)`. No high-frequency audio flows through React state.
- `src/hooks/useThreeScene.js` owns the render loop, uniforms, ping-pong trail targets, particle system, and gesture inputs. It already uses separate render targets for main output and trail accumulation.
- `src/store/useStore.js` stores audio snapshots, 5 controls, audio source state, energy state, presets, and the setter methods. The current controls are `speed`, `intensity`, `colorShift`, `chaos`, and `mode`.
- Shader contracts are fragile and critical:
  - `RawShaderMaterial` fragments must declare `precision highp float;`
  - `uMode` and `uPaletteFamily` are `int`
  - `uPaletteFamilyBlend` is `float`
  - Palette blending must remain smooth
- Existing docs are fragmented:
  - `AGENTS.md` and `CLAUDE.md` overlap
  - `.claude/` exists with rules, plans, and skills
  - `.codex/` exists in the repo and appears redundant
  - `.agents/` also exists as duplicate agent metadata

---

## Recommended File Structure

Keep the project clean and minimal with:

- `AGENTS.md` — universal project rules for all agents
- `CLAUDE.md` — thin Claude-specific wrapper referencing `AGENTS.md`
- `PLAN.md` — execution ledger / Codex-friendly task plan
- `.claude/`
  - `rules/` — engineering, shaders, audio, pipeline, state conventions
  - `plans/` — project plan references
  - `skills/` — optional if agent skills are used
  - `agents/` — optional if agent-specific config is needed

Remove or archive:
- `.codex/` — migrate any unique content into `.claude/rules/` or `.claude/plans/`
- `.agents/` — consolidate into `.claude/agents/` if needed

Optional root files:
- `README.md`
- `package.json`
- `PLAN.md`

---

## AGENTS.md

```markdown
# AGENTS.md

## Project Rules

- This is a React + Vite browser app with a fullscreen Three.js quad and raw GLSL shaders.
- The render pipeline is fixed: main shader → trail blend → particles. Do not add or alter render passes or render targets.
- Audio data must never flow through React render state. High-frequency audio is written directly via `useStore.getState().setAudioData(...)` and read in the render loop.
- All `RawShaderMaterial` fragment shaders must start with `precision highp float;`.
- `uMode` and `uPaletteFamily` are GLSL `int` uniforms. All other shader uniforms are GLSL `float`.
- `uPaletteFamilyBlend` must remain smoothed in the render loop to avoid hard palette jumps.
- Shader changes are allowed, but keep them inside existing shader files and uniforms. Do not replace the rendering architecture.
- UI work is allowed within the existing component structure. Do not introduce a separate UI/control system.
- URL share state is serialized in `src/utils/shareUtils.js`. New controls must be added there if they are shareable.

## Agent Roles

- **Codex / GPT-5.5**: implement planned feature changes, generate code, and provide self-validated patches.
- **Copilot**: assist with focused code completion, inline refactoring suggestions, and local edits.
- **Claude Code**: design architecture, review multi-file changes, and validate safety constraints.
```

---

## CLAUDE.md

```markdown
# CLAUDE.md

This file references the universal rules in `AGENTS.md`.

Use `AGENTS.md` as the authoritative guide for all agents.

## Claude-Specific Notes

- Use `PLAN.md` as the current execution ledger and task plan.
- Preserve the three-pass render pipeline, audio flow, and shader contract.
- Prefer no redundant instruction files. Migrate `.codex/` and `.agents/` content into `.claude/` if it is still needed.
- Structure: `src/hooks/useThreeScene.js`, `src/audio/bands.js`, `src/hooks/useAudioAnalyser.js`, `src/store/useStore.js`, `src/shaders/psychedelic.frag`, `src/shaders/trail.frag`.
- Do not let Claude propose large refactors or replacement systems.
```

---

## Enhanced Plan.md

### Multi-Agent Workflow Setup

1. **Consolidate docs**
   - Keep `.claude/` as the shared instruction folder.
   - Remove `.codex/` and `.agents/` after migrating any unique rule content into `.claude/rules/` or `.claude/plans/`.
   - Use `AGENTS.md` for universal agent rules and `CLAUDE.md` for Claude-specific coordination notes.
   - Keep `PLAN.md` as the execution ledger for Codex-style implementation guidance.

2. **Agent coordination**
   - **Claude Code** designs and validates architecture.
   - **Codex / GPT-5.5** executes implementation tasks.
   - **Copilot** assists with code completion and small edit verification.
   - Always hand off with:
     - target controls
     - files to modify
     - immutable constraints
     - expected verification checks

3. **Daily usage**
   - Start a session by reading `AGENTS.md`, `CLAUDE.md`, `PLAN.md`, and the current root plan.
   - Use `AGENTS.md` for universal rules.
   - Use `CLAUDE.md` for Claude-specific approvals.
   - Use `PLAN.md` to track progress and avoid duplicate work.

---

### TL;DR

Enhance the existing system by adding richer audio analysis, a second procedural shader layer, and user-facing controls without changing the three-pass pipeline or the established audio/state flow.

---

### Steps

1. **Confirm the current audio/shader contract**
   - `useAudioAnalyser.js` reads `AnalyserNode`, extracts bands in `src/audio/bands.js`, smooths them with EMA, and writes state directly to Zustand.
   - `useThreeScene.js` owns the render loop, uses `createPingPongTargets()` for trail blending, and renders particles last with `autoClear=false`.
   - Shader contracts are strict: raw fragment shaders need `precision highp float;`, and `uMode`/`uPaletteFamily` are `int`.

2. **Add spectral audio features**
   - In `src/audio/bands.js`, compute `spectralCentroid` and `spectralFlux` in addition to `sub`, `bass`, `mid`, `hi`.
   - In `src/hooks/useAudioAnalyser.js`, smooth them with the existing EMA pattern.
   - Extend `src/store/useStore.js` audio data to include these new fields.

3. **Expose Trail Decay control**
   - Add store key `trailDecay`.
   - Add slider in `src/components/ControlPanel.jsx`.
   - Add uniform `uTrailDecay` and wire it in `src/hooks/useThreeScene.js`.
   - Update `src/shaders/trail.frag` to use `uDecay`.
   - Add URL sync in `src/utils/shareUtils.js`.

4. **Add a second procedural shader layer**
   - In `src/shaders/psychedelic.frag`, add a low-frequency FBM or noise layer.
   - Modulate it with `spectralFlux` and a new uniform `uProcIntensity`.
   - Keep the existing main domain warp unchanged; blend the new layer additively.

5. **Add Camera Distance control**
   - Add store key `cameraDistance`.
   - Add slider in `ControlPanel`.
   - Add uniform `uCameraDistance` in `psychedelic.frag`.
   - Use it to scale sample coordinates or field depth for a pseudo-zoom effect.
   - Sync it via `useThreeScene.js` and `shareUtils.js`.

6. **Enhance particles**
   - Use audio data in `useThreeScene.js` to modulate particle size and alpha.
   - Add `uParticleDensity` store control and slider.
   - Keep particle rendering in the existing shader/material path and do not add render targets.
   - Ensure particles use the same palette-family blending contract.

7. **Integration and testing**
   - Run `npm run lint`.
   - Confirm shader compilation.
   - Verify visual behavior manually and preserve performance.
   - Ensure URL sharing includes new controls.

---

### Further considerations

- Keep all new controls local to existing UI structure.
- Avoid direct audio state through React.
- Keep high-frequency logic in `useAudioAnalyser.js` and render-loop logic in `useThreeScene.js`.
- Do not add any new render targets or change ping-pong behavior.
- Preserve `AGENTS.md` rules and `CLAUDE.md` as the coordination layer.

---

## Daily Multi-Agent Workflow

1. **Start session**
   - Load `AGENTS.md`, `CLAUDE.md`, `PLAN.md`.
   - Confirm agent roles and immutable constraints.

2. **Design stage**
   - Use Claude Code or Claude Pro to define the task, files, and constraints.
   - Output a plan with: scope, files, no-refactor rule, and success criteria.

3. **Implementation stage**
   - Use Codex / GPT-5.5 to modify code.
   - Provide a patch-style response: file names, exact edits, and a self-check list.
   - GPT-5.5 should verify:
     - shaders compile
     - no new render targets
     - audio flow unchanged
     - uniform types preserved
     - `npm run lint` passes

4. **Review stage**
   - Use Claude Code / Claude Pro to review changes.
   - Check architecture, immutables, and quality.
   - Approve or request incremental fixes.

5. **Completion**
   - Use Copilot for final cleanup and minor completion tasks.
   - Update `PLAN.md` with status.
   - Keep the workflow loop short:
     - planning in Claude
     - implementation in Codex
     - review in Claude
     - final polish in Copilot

---

## Minimal Implementation Steps

1. **Lock the contract**
   - Confirm `useAudioAnalyser.js` writes only via `useStore.getState().setAudioData(...)`.
   - Confirm `useThreeScene.js` uses ping-pong targets and separate particle pass.

2. **Add new audio features**
   - Add `spectralCentroid` and `spectralFlux` in `src/audio/bands.js`.
   - Smooth them in `src/hooks/useAudioAnalyser.js`.
   - Add them to `audioData` in `src/store/useStore.js`.

3. **Add trail decay**
   - Add `trailDecay` control.
   - Add `uTrailDecay` uniform and update `src/shaders/trail.frag`.

4. **Add procedural layer**
   - Add `uProcIntensity` and `uSpectralFlux` uniforms.
   - Blend a second procedural field into `psychedelic.frag`.

5. **Add camera distance**
   - Add `cameraDistance` and `uCameraDistance`.
   - Apply it in `psychedelic.frag` for pseudo-zoom.

6. **Add particles audio-reactivity**
   - Use bass/energy to modulate particle size and alpha.
   - Add `particleDensity` slider and store key.

7. **Add URL share support**
   - Extend `src/utils/shareUtils.js` for new controls.
   - Keep existing 5-control share behavior and add new fields safely.

8. **Verify**
   - Run `npm run lint`
   - Confirm shader compilation
   - Do a quick visual pass

---

This plan is built directly from the current repo state and the full discussion in this chat.