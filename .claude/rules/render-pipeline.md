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
Pass 1 (offscreen):  scene → renderTarget A      [main shader]
Pass 2 (offscreen):  trailScene → renderTarget B [blends A with previous B]
Pass 3 (screen):     finalScene → null            [draws B to canvas]
Particles:           particleScene → null          [autoClear=false, additive]
Swap A/B for next frame
```

Don't reorder these. Don't merge passes. The trail blend MUST happen between A and screen output, otherwise particles get included in the trail and smear into solid color over time.

## Ping-pong render targets

Two `WebGLRenderTarget`s in a swap. The pattern:

```js
let current = rtA
let prev    = rtB
// ...render...
const tmp = current; current = prev; prev = tmp
```

If you add a new pass that needs the previous frame, sample from `prev.texture` BEFORE the swap. If you need the result of the new pass next frame, write to a new render target you ping-pong yourself (do not reuse A/B for unrelated effects).

## Resize handling

Both render targets must resize on viewport change. `resizeRenderer(renderer, [rtA, rtB])` handles this. If you add new render targets, add them to that array too. Forgetting causes blurry/stretched output after a resize.

## Camera

Single `OrthographicCamera(-1, 1, 1, -1, 0, 1)` shared across all three passes. The full-screen quad is `PlaneGeometry(2, 2)` so it fills NDC. Don't add perspective cameras — the entire system is 2D fragment-shader-driven.

## Particle system

- Max 128 particles, fixed buffer.
- Stored as `Float32Array`s for `position`, `aAge`, `aLife`. Updated on CPU each frame.
- Spawn check: rising edge of `hi` band (`hiVal > lastHi * 0.85 && hiVal > 0.15`).
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

`THREE.Clock` is created in the closure. Use `clock.getElapsedTime()` for the `uTime` uniform. Don't call `clock.getDelta()` — it has confusing semantics (resets on call) and we use a fixed 1/60 timestep for particle ages.

## Adding a new effect post-pipeline

If you want a final screen-space effect (bloom, color grade, vignette stronger than what's in the shader):
1. Create a new `WebGLRenderTarget` for the trail output.
2. Add a new `effectScene` with a quad reading from that target.
3. Render `effectScene` to screen instead of `finalScene`.
4. Particles render after `effectScene` (still last).

Keep the trail logic intact — particles should still composite cleanly on top.
