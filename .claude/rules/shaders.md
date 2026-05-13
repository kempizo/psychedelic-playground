---
paths:
  - "src/shaders/**/*.{vert,frag,glsl}"
  - "src/hooks/useThreeScene.js"
---

# GLSL Shader Conventions

## Precision
- Every fragment shader paired with `RawShaderMaterial` MUST start with `precision highp float;` — `RawShaderMaterial` injects nothing.
- `ShaderMaterial` (used for particles) auto-injects precision and built-in uniforms (`modelViewMatrix`, `projectionMatrix`, `position`, `uv`). Don't redeclare.

## Color palette — open neon family phase
The look is "organic consciousness engine": an open cyan → violet → magenta → acid-green spectrum. Do not introduce a second visual palette system or a full rainbow gradient.

The snapped semantic family is still `uPaletteFamily`:

- Modes 0–1 target family `0`
- Modes 2–4 target family `1`

The shader palette uses `uPaletteFamilyBlend`, a float eased in `useThreeScene.js`, so switching across the family boundary does not hard-jump the hue phase. `uPaletteFamily` remains available as the discrete mode-family contract and must stay an `int`.

Current palette shape:
```glsl
vec3 a = vec3(0.50, 0.45, 0.55);
vec3 b = vec3(0.50, 0.50, 0.50);
vec3 c = vec3(1.00, 1.00, 0.50);
vec3 d = vec3(0.00, 0.33, 0.67);
float phaseOffset = uPaletteFamilyBlend * 0.33 + uPaletteShift * 0.20;
```

`uPaletteShift` is still a transient break/drift offset. Never touch the `a/b/c/d` vectors or phase multipliers without checking the full `t` distribution across surface, fog, particles, force glow, and shimmer.

Do not introduce: full rainbow gradients, warm hues (red/orange), high-contrast strobing.

Tuning hints: increase `a` to lift black floor, increase `b` to brighten, change `d` components to shift hue regions. Reference: https://iquilezles.org/articles/palettes/

## FBM + domain warping
Two warp layers (q → r → final). Don't add a third without a real reason — it kills perf and rarely improves the look.
- 6 octaves of FBM is the ceiling. More octaves = exponentially worse perf with diminishing visual return.
- Domain warp magnitude scales with `uChaos * 3.8 + 0.2` so chaos=0 still has motion (minimum 0.2), max 4.0 at chaos=1.
- `q` and `r` use separate time frequencies (`t_base` and `t_audio`). `q` drives slow organic flow; `r` is pushed forward by bass in time — not space — so kicks feel like a pulse rather than a spatial jump.
- Noise uses quintic smoothing (`f*f*f*(f*(f*6-15)+10)`) instead of cubic for smoother gradients.

## Uniforms — type discipline
GLSL fails silently on type mismatch. The setup:

| Uniform | GLSL type | JS value type |
|---------|-----------|---------------|
| `uTime`, `uBass`, `uMid`, `uHi`, `uSub`, `uSpeed`, `uIntensity`, `uColorShift`, `uChaos` | `float` | JS `number` |
| `uMouseVel`, `uColorSpike`, `uDistortionSpike`, `uEnergy`, `uPaletteShift`, `uPaletteFamilyBlend` | `float` | JS `number` |
| `uSpectralCentroid`, `uSpectralFlux`, `uProcIntensity`, `uParticleDensity`, `uCameraDistance` | `float` | JS `number` |
| `uMode`, `uPaletteFamily` | `int` | JS integer (no decimals) |
| `uResolution`, `uMouse`, `uMouseDir`, `uCamDrift` | `vec2` | `THREE.Vector2` |
| `uForces` | `vec4[8]` | `THREE.Vector4[]` — `xy=origin, z=strength (signed), w=age0to1` |
| `uForceMeta` | `vec4[8]` | `THREE.Vector4[]` — `xy=velocity, z=radius, w=unused` |
| `uCurrent`, `uPrev` | `sampler2D` | `THREE.Texture` |

When adding a uniform, declare it in BOTH the frag shader AND the `mainUniforms` object in `useThreeScene.js`. The render loop must update it each frame.

## Force field — no rings, growth attractor semantics
Clicks, drags, bass kicks, and gestures all spawn **forces** (not rings). A force is a Gaussian-falloff field disturbance: `falloff = exp(-d²/r²)`. Forces are invisible by themselves — only their distortion of the FBM domain is visible. Do NOT add visible ring SDFs or overlaid geometric shapes. `uForces` / `uForceMeta` replace the removed `uPulses` / `uPulseExtra` uniforms.

Forces should read as **the organism leaning toward / away from a point**, not as impact ripples. Default click is an inward growth attractor (low strength, wide radius, long tau). Shift+click releases outward. Drag paints a continuous soft attractor ridge — never an impact storm. Avoid stacking many short pulses to "feel" an event; one wider, longer-tau attractor reads better than five short pops.

- Negative `strength` → pull (warp inward) — used for default clicks and drag (growth attractor)
- Positive `strength` → push (warp outward) — used for shift+click releases and bass-breath
- Click defaults: strength ≈ 0.22, radius ≈ 0.55, tau ≈ 1.1s
- Drag defaults: strength ≈ 0.08, radius ≈ 0.40, tau ≈ 0.12s
- Spawn via `spawnForce(x, y, strength, sign, radius, tau)` in `useThreeScene.js`
- Rapid-click gesture fires ONE soft attractor + small `uColorSpike`, not a multi-pulse distortion storm

## Adding a new shader effect
1. Add the GLSL code to `psychedelic.frag` — use existing `fbm()`, `noise()`, `palette()` helpers.
2. If it needs a new control, add a uniform (see types table above) and a slider — or use `/add-control` skill.
3. Test both modes (`uMode == 0` and `uMode == 1`). The polar mode warps `p` differently and many effects need adjustment for it.

## Modes
There are 5 SDF ray-march modes (0–4). Do not add a 6th without removing one first.

| `uMode` | Name | Camera / SDF behaviour |
|---------|------|------------------------|
| 0 | Fluid | Orbiting camera outside blob — flowing liquid feel |
| 1 | Radial | Close macro-orbit, clips through surface — cave / tunnel |
| 2 | Vortex | Spiral UV rotation + orbiting camera; particles spawn tangentially |
| 3 | Collapse | Camera pulses inward on bass, outward on mid |
| 4 | Orbit | Three-blob SDF (`sdfOrbit`), particles spawn at 120° seam regions |

Modes 0–1 target palette family 0. Modes 2–4 target palette family 1 via `uPaletteFamily`. The visible palette phase must transition through `uPaletteFamilyBlend`, not by snapping shader color directly on the mode boundary.

Mode changes are intentionally still discrete in UI/store state. Visual continuity is maintained locally in `useThreeScene.js` with:

- dt-based `modeTransition` easing
- smoothed `uPaletteFamilyBlend`
- temporary trail-decay hold during transitions
- probabilistic previous/current particle spawn styles during transitions

## Performance budget
Target 60 fps on M1 / mid-range desktop GPU. Red flags:
- Any `for` loop in fragment shader > 8 iterations
- Texture sampling more than 2 times per pixel (we sample `uPrev` once in trail.frag — that's the budget)
- Branching on `uMode` inside FBM loops (move branches outside)

## Trail / feedback shader
`trail.frag` blends current and previous frames: `mix(current, prev, uDecay)`. `uDecay` is driven dynamically from `useThreeScene.js` each frame from behavioral/mode defaults, bass clearing, and a short transition hold. Quiet = more persistence; bass hit = faster clear; mode switch = temporarily stronger hold so old frames fade into the new mode instead of exposing a hard shader jump. Never go above 0.94 (excessive smearing) or below 0.7 (kills persistence).

## uCamDrift — slow camera drift accumulator
`uCamDrift` (vec2) is a per-session accumulator driven by sub-bass. It integrates `subNL * intensity * 0.0015` each frame using oscillating sin/cos directions so the drift wanders rather than locking to a fixed axis. Decays at `0.9975` per frame (~30s half-life). Applied as a `ro.xz` offset in all 5 camera modes. Do not drive it faster than the existing sub-band — it would stutter on kicks.

## Common bugs
- **Black screen**: usually a precision missing, or `uMode` was passed as float instead of int.
- **Banding**: increase `b` palette vector slightly, or add a tiny dither in the final pass.
- **Particles invisible**: check `gl.POINTS` is supported, `gl_PointSize` is at least 1.0, and additive blending is enabled on the material.
- **Stationary left-side seam / cut blob**: suspect screen-space polar math before lighting or trail feedback. The negative-x `atan(y, x)` branch cut appears on the left side of the canvas, so any non-periodic use of `atan`, `mod`, `abs`, or fractional sector counts can make an invisible fixed line that cuts both blob and background.
  - Keep radial/mandala sector counts integer before using `sin(angle * sectors)`.
  - In `kaleidoFold`, compute the folded polar target, then blend Cartesian positions (`mix(p, foldedP, amount)`) instead of interpolating raw polar angles across the branch cut.
  - Avoid view/Fresnel folds like `abs(dot(nrm, -rd))` unless verified; prefer `clamp(dot(nrm, -rd), 0.0, 1.0)` when the fold creates a surface crease.
  - For Orbit mode, hard `min(min(d0, d1), d2)` between blob copies can leave planar derivative creases. Use the local `smin` helper and tune the blend width before changing architecture.
  - If the seam persists under audio peaks, bypass the trail temporarily (`localDecay = 0.0`) to separate feedback ghosts from main-shader cuts, then revert the test line. If bypass does not help, inspect raymarch hit thresholds/step scale and SDF displacement amplitude.
  - Capture at least Fluid and Orbit, calm and peak, with canvas-only screenshots. UI-overlay screenshots can hide or mimic the defect.

## Visual iteration loop (execute mode only)
After any visual change, run this loop before reporting the task done:

1. Ensure `npm run dev` is running.
2. Capture screenshots with Puppeteer by default. Use `npm run screenshot -- --url http://127.0.0.1:<port>/ --out screenshots/calm.png` for the idle/calm state. For mid and peak states, drive the app as needed with Puppeteer or a focused script and save `screenshots/mid.png` and `screenshots/peak.png`.
3. Read all three captures and evaluate against: **motion smoothness**, **depth** (front-to-back separation), **cohesion** (field + particles feel like one system), **visual noise** (clutter, banding, strobing), **evolution** (slow drift, variety over time).
4. If a screenshot shows a defect, make ONE corrective change and re-loop. Do not stack untested changes.
5. This loop is execute-mode only — plan mode cannot run the dev server.
