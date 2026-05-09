---
paths:
  - "src/three/**/*.js"
  - "src/hooks/useThreeScene.js"
  - "src/components/VisualCanvas.jsx"
---

# Three.js Render Pipeline

## Three passes per frame

Each `tick()` call in `useThreeScene.js` does this:

```
Pass 1 (offscreen):  scene → rtA                  [fresh main shader]
Pass 2 (offscreen):  trailScene → trailWrite      [blends rtA with trailRead]
Pass 3 (screen):     finalScene → null            [draws trailWrite to canvas]
Particles:           particleScene → null         [autoClear=false, additive]
Swap trailRead/trailWrite for next frame
```

Don't reorder these. Don't merge passes. The trail blend MUST happen between A and screen output, otherwise particles get included in the trail and smear into solid color over time.

## Ping-pong render targets

The current pipeline uses three `WebGLRenderTarget`s:

- `rtA`: fresh main shader output each frame
- `rtB` / `rtC`: ping-pong trail accumulation

The trail pattern:

```js
let trailRead  = rtB
let trailWrite = rtC
// ...render...
const tmp = trailRead; trailRead = trailWrite; trailWrite = tmp
```

If you add a new pass that needs the previous trail frame, sample from `trailRead.texture` BEFORE the swap. Never sample from and write to the same render target in one pass; WebGL feedback loops can fail or render stale data.

## Resize handling

All render targets must resize on viewport change. `resizeRenderer(renderer, [rtA, rtB, rtC])` handles this. If you add new render targets, add them to that array too. Forgetting causes blurry/stretched output after a resize.

## Camera

Single `OrthographicCamera(-1, 1, 1, -1, 0, 1)` shared across all three passes. The full-screen quad is `PlaneGeometry(2, 2)` so it fills NDC. Don't add perspective cameras — the entire system is 2D fragment-shader-driven.

## Particle system

- Max 128 particles, fixed buffer.
- Stored as `Float32Array`s for `position`, `aAge`, `aLife`. Updated on CPU each frame.
- Spawn check: rising edge of `hi` band (`hiVal > lastHi * 0.85 && hiVal > 0.15`).
- During mode transitions, spawn style is probabilistically blended between the previous mode and current mode using the render-loop-local `modeTransition`.
- Render: `THREE.Points` with `ShaderMaterial` (NOT `RawShaderMaterial`), additive blending, no depth write.
- Particle x-position kept in `[-1, 1]` to match orthographic camera bounds. If you want full-width spread accounting for aspect ratio, update the camera bounds, not the positions.

Do not migrate this to a GPU-only particle system unless you're rebuilding the whole pipeline. The CPU version is fast at 128 particles and trivially debuggable.

## Pixel ratio

`renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))` — capped at 2 to prevent retina/4K screens from killing perf. Don't go higher.

## Writing shaders to render targets vs screen

```js
renderer.setRenderTarget(rt)      // write to render target
renderer.setRenderTarget(null)    // write to canvas
```

Always call this BEFORE `renderer.render(scene, camera)`. Forgetting means the wrong target gets cleared.

## `autoClear` for particle compositing

Particles render after the final pass with `renderer.autoClear = false` to avoid wiping the screen. Reset to `true` immediately after to preserve normal behavior for the next frame. The render loop already handles this — don't change it.

## Clock and timing

`THREE.Timer` is created in the closure. Use `timer.getElapsed()` for the `uTime` uniform and clamp `timer.getDelta()` before dt-based easing to avoid tab-refocus spikes. Particle ages still advance with the existing fixed `1 / 60` step.

Mode transition, palette-family transition, palette shift, and trail-decay smoothing should use exponential easing based on `dt`, not fixed per-frame constants.

## Adding a new effect post-pipeline

If you want a final screen-space effect (bloom, color grade, vignette stronger than what's in the shader):
1. Create a new `WebGLRenderTarget` for the trail output.
2. Add a new `effectScene` with a quad reading from that target.
3. Render `effectScene` to screen instead of `finalScene`.
4. Particles render after `effectScene` (still last).

Keep the trail logic intact — particles should still composite cleanly on top.
