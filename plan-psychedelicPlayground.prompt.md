## Plan: Extend Psychedelic Playground with Audio-Reactive Shader Layers

Only code, shader, and UI work is required; no external funding, paid tools, or third-party services are needed.

TL;DR: Enhance the existing system by adding richer audio features, a second procedural layer, and user-facing controls without changing the three-pass render pipeline or the established state/audio flow.

**Steps**
1. Confirm the current audio/shader contract. The code already uses direct audio writes (`useAudioAnalyser.js` → `useStore.getState().setAudioData(...)`), a single main fullscreen quad pass, a trail ping-pong pass, and a particle pass in `useThreeScene.js`. This is the safe foundation.
2. Add spectral audio features in `src/audio/bands.js` and `src/hooks/useAudioAnalyser.js`.
   - Compute `spectralCentroid` and `spectralFlux` alongside `sub/bass/mid/hi`.
   - Smooth them with the existing EMA pattern.
   - Keep the existing `AnalyserNode` / FFT pipeline intact.
3. Extend shader uniforms in `src/hooks/useThreeScene.js`.
   - Add new main uniforms: `uSpectralCentroid`, `uSpectralFlux`, `uTrailDecay`, `uCameraDistance`, `uParticleDensity`.
   - Add matching uniforms to the trail and particle materials where needed.
4. Implement a new low-risk procedural layer in `src/shaders/psychedelic.frag`.
   - Use existing FBM and domain warp to create a slow, audio-driven background field.
   - Add an audio-reactive surface overlay or a reaction-diffusion-like texture built from existing noise functions.
   - Keep all new code within the main shader and avoid adding render targets.
5. Add trail control and audio-driven trail behavior in `src/shaders/trail.frag`.
   - Expose `uDecay` to the UI.
   - Use `uSpectralFlux` or `uEnergy` to modulate trail drift and brightness.
6. Enhance the particle system in `src/shaders/particle.vert` and `particle.frag`.
   - Use audio features to modulate particle size, alpha, and palette hue.
   - Optionally add a curl-noise influence to the existing CPU velocity-based spawn behavior.
7. Expose UI controls in `src/components/ControlPanel.jsx`.
   - Add sliders for `Trail Decay`, `Camera Distance`, `Particle Density`, and optionally `Reaction Strength`.
   - Keep the existing control panel layout and mode buttons.
8. Wire the controls into `useStore.js` if new persistent UI control state is required.
   - Add new store keys only when the UI needs stable persisted values.
   - Keep audio data and behavioral state unchanged.
9. Validate with manual browser testing and linting.
   - Confirm shader compilation, mode switching, fullscreen/`H` behavior, particle spawns, and audio reactivity.
   - Run `npm run lint` after changes.

**Relevant files**
- `src/audio/bands.js` — add spectral centroid/flux extraction.
- `src/hooks/useAudioAnalyser.js` — smooth and write new audio features.
- `src/hooks/useThreeScene.js` — add uniforms, wire particles, camera distance, trail decay, and audio-driven spawn logic.
- `src/shaders/psychedelic.frag` — add second procedural layer, audio-driven background, and palette modulation.
- `src/shaders/trail.frag` — expose trail decay and audio-driven blend.
- `src/shaders/particle.vert` / `src/shaders/particle.frag` — add audio-reactive particle behavior.
- `src/components/ControlPanel.jsx` — add UI sliders for new parameters.
- `src/store/useStore.js` — only if new persistent controls are needed.

**Verification**
1. Confirm `psychedelic.frag` and `trail.frag` compile cleanly after adding uniforms.
2. Verify `useAudioAnalyser.js` writes `spectralCentroid` and `spectralFlux` into `audioData` without breaking the existing `beatPhase` path.
3. Check that the new controls appear in the UI and update the shader uniforms in real time.
4. Validate performance visually on an M1-class machine; keep the update budget by limiting new noise/flow calculations.
5. Run `npm run lint` to ensure JS edits pass code style.

**Decisions**
- Keep the current render pipeline intact: main shader -> trail blend -> final pass -> particles.
- Do not add a new render target or separate post-processing composer.
- Use the existing `uPaletteFamilyBlend` and palette math pattern rather than building a new palette system.
- Keep gesture contracts and `uMouse` semantics unchanged.

**Further considerations**
1. If the particle system needs more audio influence, prioritize `uHi` + `uSpectralFlux` for intensity and keep count capped at `MAX_PARTICLES`.
2. If shader cost rises, keep the new procedural layer low-frequency and audio-driven rather than a full reaction-diffusion pass.
3. For a faster win, implement the new audio features and control sliders first, then add the visual layer in a second pass.
