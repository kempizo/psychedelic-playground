# Psychedelic Playground — System Audio + Musical Smoothing Upgrade

## Context

Why this change: the playground currently accepts only **microphone** or **uploaded file** as audio sources. Users want to drive the visuals from whatever music/video is playing on their machine (Spotify in a tab, YouTube, etc.). At the same time, occasional "click-like" distortion (sharp ripples on silence/transients) and trail ghosting during high-motion passages have been noted.

This change does three additive things:
1. Adds a third user-gesture-triggered audio source — **System / Tab Audio** — wired into the existing singleton Web Audio graph via `getDisplayMedia`.
2. Exposes a small set of **named, attack/release-smoothed derived lanes** (`subBody`, `bassPunch`, `midMotion`, `highSparkle`, `brightness`, `fluxPulse`, `silenceAmount`, `motionEnergy`) that the render loop and any future code can map to without rederiving smoothing each time. Most are aliases of fields the analyser already computes; the new value is the `fluxPulse` cooldown, the harder silence-gate on transients, and `motionEnergy` for trail modulation.
3. Slightly tightens existing shader/particle/trail mappings using those lanes — *no* new render passes, *no* new visual systems, *no* new uniforms unless strictly needed, *no* signature changes to public store fields.

The architecture contracts (singleton AudioContext, three-pass pipeline, getState() in rAF loop, no audioData through React render state, particles last + additive) are preserved.

## Decisions confirmed with user

- **Display audio is analyser-only** (not connected to `ctx.destination`) — system audio keeps playing from its original tab/app; we just tap it.
- **Moderate anti-click suppression** — extra `quietDamp` multiplication on `onset` and `spectralFlux` during deep silence only; bassPunch/fluxPulse not hard-zeroed so quiet passages still breathe.
- **Light particle tightening** — only add `silenceAmount` gating to a couple of existing particle paths that aren't already gated. No structural change.

## Files to touch

| File | Change |
|------|--------|
| `src/audio/displayAudio.js` | **NEW** — `connectDisplayAudio(onEnded)` + `stopDisplayAudio()`, mirrors `mic.js` pattern. Uses `getDisplayMedia({ audio: { systemAudio: 'include', echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: true })`. Validates `stream.getAudioTracks().length`, listens for track `ended`, drops video track immediately. **Not** routed to speakers. |
| `src/components/AudioInput.jsx` | Add third button **"System / Tab Audio"**. On click → `start(() => connectDisplayAudio(onSourceEnded))`. On the specific `NO_AUDIO_TRACK` error, show: *"No audio track was shared. Try selecting a tab/window and enable 'Share audio' in the picker, or use microphone/file input."* Add a small note below the buttons: *"System audio capture is browser/OS dependent. On macOS, choose a tab and enable Share audio."* Accept an `onSourceEnded` callback prop. |
| `src/components/LandingScreen.jsx` | Pass `onSourceEnded={handleReset}`-style callback down to `AudioInput` (verify wiring; LandingScreen already calls `onStarted`). |
| `src/App.jsx` | In `handleReset()`, also call `stopDisplayAudio()`. Pass `handleReset` through to LandingScreen → AudioInput as the source-ended handler. |
| `src/store/useStore.js` | Extend `audioData` defaults with the eight new keys defaulted to `0` (`silenceAmount` defaults to `1`). `audioSource` literal range becomes `'mic' \| 'file' \| 'display' \| null` — no shape change since it's already a free string. |
| `src/hooks/useAudioAnalyser.js` | Add eight derived lanes to `smoothed.current` and write them in the loop (see below). No change to existing fields — purely additive. Add `pulseState` ref for flux cooldown. Apply extra `quietDamp` to `s.onset` and `s.spectralFlux` during deep silence (additive). |
| `src/hooks/useThreeScene.js` | Read the new lanes in `tick()`. Use `motionEnergy` and `fluxPulse` to bias `targetDecay` downward slightly. Add `silenceAmount` gating to a couple of particle paths. **No new uniforms.** Existing `uSilence`, `uOnset`, `uTreblePulse`, `uAudioPulse`, `uAudioTurbulence`, `uAudioDetail`, `uAudioBody`, `uAudioBrightness` already cover the shader mapping; we just feed cleaner inputs. |

No shader files (`*.frag`, `*.vert`) are modified in this slice. The shader contract stays intact: `precision highp float`, `uMode`/`uPaletteFamily` as ints, `uPaletteFamilyBlend` as render-loop-smoothed float, particle additive blending last. No render-target or pass-count changes.

## Derived lane definitions (in `useAudioAnalyser.js`)

All written each frame after the existing `s.bassPulse / s.midPulse / s.treblePulse / s.onset / s.silence` block at [src/hooks/useAudioAnalyser.js:154-165](../../src/hooks/useAudioAnalyser.js#L154-L165). They reuse the existing `ema(prev, next, aAtk, aRel)` helper.

| Lane | Derivation | aAtk | aRel | Notes |
|------|------------|------|------|-------|
| `subBody` | `s.sub * 0.6 + s.bass * 0.4` | 0.25 | 0.10 | Slow attack/release — large-scale breathing pressure. |
| `bassPunch` | `clamp01(s.bassPulse * 1.0 + Math.max(0, s.bass - a.bass)) * quietDamp` | 0.85 | 0.32 | Fast attack, medium release. Already adaptive via `a.bass`. |
| `midMotion` | `s.lowMid * 0.35 + s.mid * 0.55 + s.midPulse * 0.20` | 0.55 | 0.40 | Medium speed. |
| `highSparkle` | `clamp01((s.highMid * 0.45 + s.treble * 0.55 + s.treblePulse * 0.25 - 0.08) * quietDamp²)` | 0.88 | 0.45 | Hard-gated by `quietDamp` squared so silence kills sparkle entirely. Floor of 0.08 cuts hiss. |
| `brightness` | `s.spectralCentroid * 0.55 + (s.treble * 0.25 + s.highMid * 0.20) * 0.45` | 0.28 | 0.18 | Smooth tonal brightness, no jitter. |
| `fluxPulse` | gated `s.spectralFlux * onsetGate * cooldown` (see below) | 0.82 | 0.30 | Cooldown-clamped portal shimmer. |
| `silenceAmount` | alias of existing `s.silence` write target — same smoothing (0.20 atk / 0.48 rel) | — | — | Named for clarity. |
| `motionEnergy` | `clamp01(s.midPulse * 0.4 + s.treblePulse * 0.35 + s.spectralFlux * 0.5 + s.onset * 0.2)` | 0.45 | 0.30 | Used by trail decay. |

**fluxPulse cooldown** (state on a new `pulseState` ref):
```js
const fluxCooldown = Math.max(0, pulseState.fluxCooldown - dt)
const fluxArmed = fluxCooldown <= 0 && energy > 0.06 && !silence.isSilent
const fluxRaw = fluxArmed ? Math.min(1, s.spectralFlux * 1.4) : 0
if (fluxArmed && fluxRaw > 0.45) pulseState.fluxCooldown = 0.18  // 180ms
else pulseState.fluxCooldown = fluxCooldown
s.fluxPulse = ema(s.fluxPulse, fluxRaw * quietDamp, 0.82, 0.30)
```

**Extra silence safety** (anti-click, moderate): at the bottom of the loop, when `silence.isSilent || energy < 0.022`, multiply `s.onset` *and* `s.spectralFlux` by `quietDamp` an additional time. This is additive — stacks on top of the existing `s.spectralFlux *= quietDamp` at [useAudioAnalyser.js:195](../../src/hooks/useAudioAnalyser.js#L195) only in deep silence, leaving normal-energy frames untouched.

## Render-loop refinements (`useThreeScene.js`)

Read new lanes near [useThreeScene.js:634](../../src/hooks/useThreeScene.js#L634) where `audioData` is destructured:
```js
const motionEnergy   = audioData.motionEnergy ?? 0
const fluxPulse      = audioData.fluxPulse ?? 0
const silenceAmount  = audioData.silenceAmount ?? audioData.silence ?? 0
```

**Trail effective decay** ([useThreeScene.js:1099-1113](../../src/hooks/useThreeScene.js#L1099-L1113)): add `motionDecayBias` and `fluxDecayBias` to the existing `targetDecay` computation. `silenceHold01` is already present at line 1109 — *do not* duplicate.
```js
const motionDecayBias = motionEnergy * 0.018
const fluxDecayBias   = fluxPulse * 0.020
const targetDecay = Math.max(0.68, Math.min(0.94,
  Math.max(minDecay,
    baseDecay - bassClear - growthClear - transitionClear
              - motionDecayBias - fluxDecayBias + silenceHold01
  )
))
```

**No new uniforms, no new render passes.** Existing `mainUniforms.uOnset / uSilence / uAudioPulse / uAudioBody / uAudioDetail / uAudioTurbulence / uAudioBrightness` already cover the shader mapping requirements; cleaner input data does the work.

**Particle tightening** ([useThreeScene.js:1244, 1267, 1301](../../src/hooks/useThreeScene.js#L1244)):
- The `radialKick = (bassPulse * 0.000075 + onset * 0.000022 + visualState.audioPulse * 0.000045)` line at L1301 already has a `shimmerGate` — multiply that gate by `(1 - silenceAmount * 0.85)` so silence pulls particles to calm motion.
- Wherever a particle path uses raw `onset` without a silence factor (verify during implementation), multiply by `(1 - silenceAmount * 0.7)`.
- No structural change to the particle loop, no buffer-size change, additive blending preserved.

## Display-audio module shape (`src/audio/displayAudio.js`)

```js
import { resumeContext, connectSource } from './analyser'

let activeStream = null
let endedHandler = null

export async function connectDisplayAudio(onEnded) {
  stopDisplayAudio()
  const stream = await navigator.mediaDevices.getDisplayMedia({
    audio: {
      systemAudio: 'include',
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    video: true, // browsers require a display surface; we stop the video track immediately
  })
  const audioTracks = stream.getAudioTracks()
  if (audioTracks.length === 0) {
    stream.getTracks().forEach(t => t.stop())
    const err = new Error('NO_AUDIO_TRACK')
    err.code = 'NO_AUDIO_TRACK'
    throw err
  }
  // Drop video — we don't render it, just keep the audio.
  stream.getVideoTracks().forEach(t => t.stop())
  activeStream = stream
  endedHandler = () => { stopDisplayAudio(); onEnded?.() }
  audioTracks[0].addEventListener('ended', endedHandler)
  const ctx = resumeContext()
  const source = ctx.createMediaStreamSource(stream)
  connectSource(source) // analyser-only; system audio already plays from its original tab/app
  return stream
}

export function stopDisplayAudio() {
  if (activeStream) {
    activeStream.getTracks().forEach(t => t.stop())
    activeStream = null
    endedHandler = null
  }
}
```

`AudioInput` passes a callback that calls `handleReset` (via prop chain from App) when the user ends the share session from the browser bar — UI returns to the landing screen.

## Critical files

- [src/audio/displayAudio.js](../../src/audio/displayAudio.js) — new module
- [src/audio/analyser.js:23-27](../../src/audio/analyser.js#L23-L27) — existing `connectSource()` reused
- [src/audio/mic.js](../../src/audio/mic.js) — pattern reference
- [src/audio/fileAudio.js](../../src/audio/fileAudio.js) — pattern reference
- [src/components/AudioInput.jsx:37-75](../../src/components/AudioInput.jsx#L37-L75) — add third button + helper text + `onSourceEnded` prop
- [src/components/LandingScreen.jsx](../../src/components/LandingScreen.jsx) — wire prop through
- [src/App.jsx:23-29](../../src/App.jsx#L23-L29) — extend `handleReset()`; pass reset through to LandingScreen
- [src/store/useStore.js:18-40](../../src/store/useStore.js#L18-L40) — extend `audioData` defaults
- [src/hooks/useAudioAnalyser.js:8-30](../../src/hooks/useAudioAnalyser.js#L8-L30) — extend `smoothed` and main loop, add `pulseState` ref
- [src/audio/bands.js](../../src/audio/bands.js) — **no change** (raw band extraction is fine)
- [src/hooks/useThreeScene.js:1099-1113](../../src/hooks/useThreeScene.js#L1099-L1113) — trail bias additions
- [src/hooks/useThreeScene.js:1244-1338](../../src/hooks/useThreeScene.js#L1244-L1338) — particle uniform tightening

## Functions/utilities reused (no reinvention)

- `getAudioContext()`, `resumeContext()`, `connectSource()` at [src/audio/analyser.js](../../src/audio/analyser.js) — used by all three sources.
- `createAnalyser()` is already called inside `AudioInput.start()` ([src/components/AudioInput.jsx:16](../../src/components/AudioInput.jsx#L16)); display audio goes through the same `start(fn)` wrapper.
- `ema()` helper in [src/hooks/useAudioAnalyser.js:61-65](../../src/hooks/useAudioAnalyser.js#L61-L65) — reused for new lane smoothing.
- Existing `quietDamp` at [useAudioAnalyser.js:143-145](../../src/hooks/useAudioAnalyser.js#L143-L145) — reused as the anti-click silence multiplier.
- Existing `adaptive` floor refs at [useAudioAnalyser.js:38-42](../../src/hooks/useAudioAnalyser.js#L38-L42) — reused for `bassPunch`.
- Existing trail-decay clamp at [useThreeScene.js:1110](../../src/hooks/useThreeScene.js#L1110) — extended, not replaced.

## URL / preset state

`audioSource` is **not** URL-serialized or preset-saved today (per [src/utils/shareUtils.js:3-14](../../src/utils/shareUtils.js#L3-L14) and [src/utils/presetUtils.js:5-15](../../src/utils/presetUtils.js#L5-L15), and explicitly per `.claude/rules/state.md` "URL sync"). The new `'display'` value follows the same rule — *not* added to URL params. `getDisplayMedia` requires a user gesture, so auto-starting from a shared URL is impossible anyway.

## Verification

1. **Build / lint** — `npm run build` and `npm run lint` (or `npm run dev` smoke test).
2. **Manual scenarios**:
   - Mic → still works, visuals respond.
   - File upload → still works, file plays through speakers.
   - **System / Tab Audio**: click button, browser picker appears, choose tab/window with "Share audio" enabled, visuals respond. System audio plays from its original tab — not duplicated through the analyser to speakers (analyser-only routing).
   - System / Tab Audio with "Share audio" *unchecked* → friendly error: "No audio track was shared…" Tracks are stopped; UI is unlocked.
   - Switching mic → file → display in any order: previous tracks stop, no audio leaks, no orphan AudioBufferSource/MediaStream.
   - Browser "Stop sharing" bar → `ended` event resets UI back to landing screen.
   - Component unmount → all `stop*()` helpers fire from `handleReset` chain (already covered when the user presses "Change source").
3. **Audio quality**:
   - Silence (no track / muted source) → no random click-like ripples in the shader. Slow breathing motion only.
   - Loud bass-heavy track → controlled membrane pulse, not screen-tap distortion.
   - High-motion/dense track → trails noticeably less smeary than before (motionEnergy + fluxPulse biases).
   - Particles still feel emitted from organism/portal seams; quiet passages calm them.
4. **Render-pipeline check** — confirm via `useThreeScene.js` that no new render pass / RT / uniform was added; render order unchanged: main → trail accumulate → screen → particles.
5. **Architecture contracts** — `RawShaderMaterial` precision unchanged; `uMode`/`uPaletteFamily` still ints; `uPaletteFamilyBlend` still float-smoothed; particles still additive + last; audioData still flows via `getState()`, not React state.

## Out of scope

- No shader edits in this slice.
- No new uniforms.
- No new visual systems / new mode counts / postprocessing / backend.
- No serialization of `audioSource` to URL/presets.
- No `getDisplayMedia` constraint experimentation beyond the documented best-effort defaults — browser/OS variance is documented in the UI helper text.

## Browser limitations to surface

- macOS Chrome: tab audio works; full window/screen audio requires "Share audio" checkbox in picker and may still be unavailable for the entire-desktop scope.
- Firefox: limited `getDisplayMedia` audio support; UI will report `NO_AUDIO_TRACK` cleanly.
- Safari: `getDisplayMedia` may reject — same `NO_AUDIO_TRACK` path will show the helpful message.

## Follow-ups (not in this slice, do not implement now)

- Optional `audioGain` slider — `display` audio levels vary widely.
- A `LiveBands` debug overlay for the new lanes.
- A `'systemAudio'` chip in the UI top-bar showing the active source.
