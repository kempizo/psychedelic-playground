---
paths:
  - "src/store/**/*.js"
  - "src/components/**/*.jsx"
  - "src/hooks/useURLState.js"
  - "src/utils/shareUtils.js"
---

# State Management

Single Zustand store at `src/store/useStore.js`. No Context, no Redux, no React `useState` for shared state.

## Store shape

```js
{
  // Audio data — written 60×/sec from useAudioAnalyser via getState()
  audioData: { sub, bass, mid, hi, spectralCentroid, spectralFlux },

  // UI controls — written by ControlPanel, read by useThreeScene each frame
  speed, intensity, colorShift, chaos, mode, trailDecay, cameraDistance, procIntensity, particleDensity,

  // Audio source state — written by AudioInput
  audioSource, isPlaying,

  setAudioData, setControl, setAudioSource, setIsPlaying,
}
```

## Two access patterns

**React components**: subscribe via the hook
```js
const { speed, setControl } = useStore()
```
This re-renders the component when `speed` changes. Use this in `ControlPanel`, `ShareButton`, etc.

**60fps loops**: read via `getState()` — no subscription
```js
const { audioData, speed, intensity, ... } = useStore.getState()
```
Used in `useThreeScene`'s `tick()` and `useAudioAnalyser`'s rAF loop. NEVER subscribe to `audioData` from a component — it changes 60×/sec and would re-render the whole tree.

## URL sync

`useURLState` hook does two things:
1. On mount: reads `window.location.search`, deserializes via `shareUtils`, applies via `setControl`.
2. After mount: subscribes to store changes and pushes serialized state to `history.replaceState` (no navigation).

**Don't add `audioData` to URL params.** Only user-facing controls belong in share state. The `serialize`/`deserialize` keys list lives in `shareUtils.js` — keep them in sync if you add a control.

## Adding a new control

Use the `/add-control` skill if you can. Otherwise:
1. Add field + default to `useStore.js`.
2. Add row to `CONTROLS` array in `ControlPanel.jsx`.
3. Add uniform in `useThreeScene.js` (`mainUniforms`).
4. Update uniform inside the `tick()` function.
5. Use it in `psychedelic.frag`.
6. Add the key to `KEYS` and `DEFAULTS` in `shareUtils.js` so it serializes.

Forgetting step 6 means the new control silently fails to share via URL.

## Don't

- Don't put audio data, audio source state, or transient UI state into `useState` in components — it desyncs from the store and causes visual stutter.
- Don't pass the store object via context or props — import `useStore` directly where needed.
- Don't add derived/computed values to the store — derive at read time. Zustand has selector support for this if memoization matters.
