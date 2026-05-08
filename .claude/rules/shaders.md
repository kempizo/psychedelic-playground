---
paths:
  - "src/shaders/**/*.{vert,frag,glsl}"
  - "src/hooks/useThreeScene.js"
---

# GLSL Shader Conventions

## Precision
- Every fragment shader paired with `RawShaderMaterial` MUST start with `precision highp float;` — `RawShaderMaterial` injects nothing.
- `ShaderMaterial` (used for particles) auto-injects precision and built-in uniforms (`modelViewMatrix`, `projectionMatrix`, `position`, `uv`). Don't redeclare.

## Color palette — fixed
The look is "organic consciousness engine": teal → acid green → deep violet emerging from near-black (`#050505`). Do not introduce:
- Full rainbow gradients
- Warm hues (red/orange/magenta) — they break the aesthetic
- High-contrast strobing

The cosine palette in `psychedelic.frag`:
```glsl
vec3 a = vec3(0.05, 0.08, 0.10);   // dark base
vec3 b = vec3(0.38, 0.48, 0.28);   // range
vec3 c = vec3(1.00, 0.80, 1.20);   // frequency
vec3 d = vec3(0.45, 0.25, 0.65);   // teal/green/violet offsets
return a + b * cos(6.28318 * (c * t + d));
```
Tuning hints: increase `a` to lift black floor, increase `b` to brighten, change `d` components to shift hue regions. Reference: https://iquilezles.org/articles/palettes/

## FBM + domain warping
Two warp layers (q → r → final). Don't add a third without a real reason — it kills perf and rarely improves the look.
- 6 octaves of FBM is the ceiling. More octaves = exponentially worse perf with diminishing visual return.
- Domain warp magnitude scales with `uChaos * 1.8 + 0.2` so chaos=0 still has motion.

## Uniforms — type discipline
GLSL fails silently on type mismatch. The setup:

| Uniform | GLSL type | JS value type |
|---------|-----------|---------------|
| `uTime`, `uBass`, `uMid`, `uHi`, `uSub`, `uSpeed`, `uIntensity`, `uColorShift`, `uChaos` | `float` | JS `number` |
| `uMode` | `int` | JS integer (no decimals) |
| `uResolution` | `vec2` | `THREE.Vector2` |
| `uCurrent`, `uPrev` | `sampler2D` | `THREE.Texture` |

When adding a uniform, declare it in BOTH the frag shader AND the `mainUniforms` object in `useThreeScene.js`. The render loop must update it each frame.

## Adding a new shader effect
1. Add the GLSL code to `psychedelic.frag` — use existing `fbm()`, `noise()`, `palette()` helpers.
2. If it needs a new control, add a uniform (see types table above) and a slider — or use `/add-control` skill.
3. Test both modes (`uMode == 0` and `uMode == 1`). The polar mode warps `p` differently and many effects need adjustment for it.

## Modes
- `uMode == 0` (Fluid): Cartesian domain warp, flowing liquid feel.
- `uMode == 1` (Radial): converts `p` to polar before warping, mandala-like radial symmetry.

To add a new mode, branch on `uMode` early. Don't add more than 3 modes total — proliferating modes dilutes the experience.

## Performance budget
Target 60 fps on M1 / mid-range desktop GPU. Red flags:
- Any `for` loop in fragment shader > 8 iterations
- Texture sampling more than 2 times per pixel (we sample `uPrev` once in trail.frag — that's the budget)
- Branching on `uMode` inside FBM loops (move branches outside)

## Trail / feedback shader
`trail.frag` blends current and previous frames: `mix(current, prev, uDecay)`. `uDecay = 0.82` is tuned. Going above 0.9 produces excessive smearing; below 0.7 kills the dream-like persistence.

## Common bugs
- **Black screen**: usually a precision missing, or `uMode` was passed as float instead of int.
- **Banding**: increase `b` palette vector slightly, or add a tiny dither in the final pass.
- **Particles invisible**: check `gl.POINTS` is supported, `gl_PointSize` is at least 1.0, and additive blending is enabled on the material.
