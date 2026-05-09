---
paths:
  - "src/shaders/**/*.{vert,frag,glsl}"
  - "src/hooks/useThreeScene.js"
---

# GLSL Shader Conventions

## Precision
- Every fragment shader paired with `RawShaderMaterial` MUST start with `precision highp float;` — `RawShaderMaterial` injects nothing.
- `ShaderMaterial` (used for particles) auto-injects precision and built-in uniforms (`modelViewMatrix`, `projectionMatrix`, `position`, `uv`). Don't redeclare.

## Color palette — dual family system
The look is "organic consciousness engine". Two palette families exist; do not introduce a third.

**Family 0 — default** (teal → acid green → deep violet, near-black base):
```glsl
vec3 a = vec3(0.05, 0.08, 0.10);
vec3 b = vec3(0.38, 0.48, 0.28);
vec3 c = vec3(1.00, 0.80, 1.20);
vec3 d = vec3(0.45, 0.25, 0.65);
```

**Family 1 — break/pink** (deep purple → electric violet → neon pink, triggered by break events):
```glsl
vec3 a = vec3(0.10, 0.04, 0.14);
vec3 b = vec3(0.55, 0.20, 0.45);
vec3 c = vec3(1.10, 0.70, 1.20);
vec3 d = vec3(0.95, 0.10, 0.55);
```

The blend is controlled by `uPaletteFamily` (0 or 1, set by mode >= 2) and `uPaletteShift` (0–1 float, pushed by break events). The final `palette(t)` call in the shader mixes both families based on these. Never touch the `a/b/c/d` vectors without understanding how the full `t` distribution maps across the cosine. The palette bias is `t = value * 0.4 + 0.72` (centers on acid-green, avoids the red zone at t≈0.5).

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
| `uMouseVel`, `uColorSpike`, `uDistortionSpike`, `uEnergy`, `uPaletteShift` | `float` | JS `number` |
| `uMode`, `uPaletteFamily` | `int` | JS integer (no decimals) |
| `uResolution`, `uMouse`, `uMouseDir`, `uCamDrift` | `vec2` | `THREE.Vector2` |
| `uPulses`, `uPulseExtra` | `vec4[8]` | `THREE.Vector4[]` |
| `uCurrent`, `uPrev` | `sampler2D` | `THREE.Texture` |

When adding a uniform, declare it in BOTH the frag shader AND the `mainUniforms` object in `useThreeScene.js`. The render loop must update it each frame.

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

Modes 0–1 use palette family 0 (teal/green/violet). Modes 2–4 use palette family 1 (pink/violet) via `uPaletteFamily`.

## Performance budget
Target 60 fps on M1 / mid-range desktop GPU. Red flags:
- Any `for` loop in fragment shader > 8 iterations
- Texture sampling more than 2 times per pixel (we sample `uPrev` once in trail.frag — that's the budget)
- Branching on `uMode` inside FBM loops (move branches outside)

## Trail / feedback shader
`trail.frag` blends current and previous frames: `mix(current, prev, uDecay)`. `uDecay` is now driven dynamically from `useThreeScene.js` each frame: `0.84 − uBass * 0.04`, clamped to [0.80, 0.84]. Quiet = more persistence (0.84); bass hit = faster clear (0.80). Never go above 0.9 (excessive smearing) or below 0.7 (kills persistence).

## uCamDrift — slow camera drift accumulator
`uCamDrift` (vec2) is a per-session accumulator driven by sub-bass. It integrates `subNL * intensity * 0.0015` each frame using oscillating sin/cos directions so the drift wanders rather than locking to a fixed axis. Decays at `0.9975` per frame (~30s half-life). Applied as a `ro.xz` offset in all 5 camera modes. Do not drive it faster than the existing sub-band — it would stutter on kicks.

## Common bugs
- **Black screen**: usually a precision missing, or `uMode` was passed as float instead of int.
- **Banding**: increase `b` palette vector slightly, or add a tiny dither in the final pass.
- **Particles invisible**: check `gl.POINTS` is supported, `gl_PointSize` is at least 1.0, and additive blending is enabled on the material.
