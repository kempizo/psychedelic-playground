---
paths:
  - "src/audio/**/*.js"
  - "src/hooks/useAudioAnalyser.js"
  - "src/components/AudioInput.jsx"
---

# Web Audio Conventions

## Singleton AudioContext
There is exactly ONE `AudioContext` per page lifetime. `src/audio/analyser.js` lazily creates it via `getAudioContext()` and caches the singleton. Never call `new AudioContext()` directly elsewhere.

Why: `AudioContext` instances are expensive, browsers limit them, and multiple contexts cannot share an `AnalyserNode`.

## User gesture requirement (Safari + Chrome)
`AudioContext` starts in `suspended` state on Safari and recent Chrome. It MUST be resumed inside a user-gesture handler (click, tap, key press). The pattern in this codebase:

```js
// In a click handler:
createAnalyser()           // calls resumeContext() internally
await connectMic()         // or connectFile(file)
```

If you skip the gesture, `decodeAudioData` and mic capture silently produce zeros and visuals stay flat.

## FFT extraction
`AnalyserNode.fftSize = 2048` → `frequencyBinCount = 1024` bins. Each bin = `sampleRate / fftSize` ≈ 21.5 Hz at 44.1 kHz.

`bands.js` extracts four normalized band amplitudes plus spectral descriptors:

| Band | Bins | Hz |
|------|------|-----|
| `sub` | 0–4 | 0–86 |
| `bass` | 4–20 | 86–430 |
| `mid` | 20–100 | 430–2150 |
| `hi` | 100–400 | 2150–8600 |

It also computes `spectralCentroid` and `spectralFlux` from the FFT frame. `useAudioAnalyser.js` smooths both with the same direct-to-store pattern as the core bands. Silence should keep flux near zero.

If you change `fftSize`, update bin ranges proportionally.

## Smoothing
Two layers of smoothing prevent jitter:
1. `AnalyserNode.smoothingTimeConstant = 0.75` — built-in temporal smoothing on FFT magnitudes.
2. Exponential moving average per band in `useAudioAnalyser.js` — different α per band (bass slower, hi faster) so the visuals feel right.

Don't remove either layer. Removing #2 makes the visuals jitter visibly. Removing #1 makes them feel laggy because of the harsher α you'd need.

## Writing audio data to the store
**Never** call `useStore((s) => s.setAudioData)` from inside a React component or hook that renders on update. That re-subscribes 60×/sec.

Correct pattern (used in `useAudioAnalyser`):
```js
useStore.getState().setAudioData({ ...smoothed.current })
```

`getState()` is a non-subscribing read. `setAudioData` triggers a Zustand update but the only subscriber that reads `audioData` is `useThreeScene`'s rAF loop, which uses `getState()` not a hook subscription — so React never re-renders for audio updates.

## File audio
- Use `decodeAudioData` not the deprecated callback form.
- We loop by default (`activeSource.loop = true`). Stopping is via `stopFile()` to avoid orphan sources.
- Large files (10+ min) take a few seconds to decode. Show a loading state if you add such uploads.

## Mic
- Always pass `{ audio: true, video: false }` — explicit `video: false` avoids Safari weirdness.
- Mic level varies wildly between devices. The `Intensity` slider compensates; don't try to AGC.

## Cleanup
`destroyAnalyser()` exists but is intentionally NOT called on component unmount because the canvas is always mounted. If you ever add a "stop and reset" UI flow, call it then.
