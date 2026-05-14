# Visual Coherence Fix — Fog/Flow Background Replacement

## Context

The current shader produces a disconnected look: the central organism (SDF blob) reads as one thing, and the background reads as a separate "wallpaper" of cellular/FBM patterns. The goal is the smallest possible change that makes the background feel like it *belongs to the same organism* — fog, flow, and distant membrane density all derived from the same warped coordinates as the blob, not a second surface pattern.

**No render pipeline changes. No new uniforms. No new visual systems.**

---

## Diagnosis — Exact Code Locations

### 1. Wallpaper-like background (primary problem)
**File:** `src/shaders/psychedelic.frag` **Lines 907–919** (the `else` branch — ray miss case)

```glsl
// Line 912 — bgFog uses bgN at full amplitude as a textured surface
vec3 bgFog = deepColor(bgT + layerCycle + fieldDetail * 0.06, ...) * (0.15 + bgN * 0.080 + fieldDetail * 0.030 + ...);
```
`bgFog` is added unconditionally at `0.15` baseline — visible across the whole miss region regardless of energy or depth. The `bgN` coefficient `0.080` and `fieldDetail` coefficient `0.030` modulate the brightness with the FBM field, creating a crawling patterned surface that reads as wallpaper. Same problem on line 917: `depthFog * 0.024` adds a second faint tinted layer at full field extent.

### 2. Glow/halo disconnection
**Lines 909–914** — `glow` is computed from `minD` (SDF edge proximity) but then `bgFog` is added directly on top of it at full amplitude regardless of proximity. The `bgFog` brightness floor makes the whole miss region uniformly bright, washing out the depth fall-off that `glow` creates.

### 3. Procedural vein/cellular overlay (secondary wallpaper)
**Lines 1039–1064** — `wallCells` (line 978) added into `tunnelI` and then `veinEdge` bleed into the miss region via `veinAtmosphereMask` (line 1054). Both are visible across the whole background when `audioPresence` is high. `veinStrength` is clamped at `0.016` but applies everywhere in the miss region.

### 4. Fractal detail placement
**Lines 962–999** — Portal Mandelbrot and tunnel compositing work correctly — they're properly masked by `portalMask * portalDepthGate * portalInwardGate`. Not causing the wallpaper. The `tunnelI` contribution on line 993 (`tunnelGain = 0.55 + tunDepth * 0.78`) can be strong but is gated by `tunDepth`. Fine as-is.

### 5. Audio displacement/pulse behavior
No direct issue. The background brightness lifting under audio (`bgFog` responding to `uCoreEnergy * 0.025`) compounds the wallpaper problem — when energy is high the whole background lights up uniformly.

---

## Implementation Plan — 3 Steps

### Step 1 — Kill the bgFog floor; replace with depth-stratified fog

**Target:** Lines 906–919 (the ray-miss else branch)

Replace the flat `bgFog` add with a depth-attenuated fog that falls off quickly from the organism silhouette. The `bgFog` base value `0.15` becomes `0.04`, and its `bgN` modulation is cut to `0.025` (from `0.080`). `fieldDetail * 0.030` cut to `fieldDetail * 0.008`. This prevents the miss region from reading as a lit surface.

```glsl
// BEFORE (line 912)
vec3 bgFog = deepColor(bgT + layerCycle + fieldDetail * 0.06, vec3(0.00, 0.11, 0.15))
           * (0.15 + bgN * 0.080 + fieldDetail * 0.030 + uCoreEnergy * 0.025);

// AFTER — depth-attenuated, organism-proximity dominant
float bgDepthFade = 1.0 - smoothstep(0.0, 0.65, depth01);  // dark at far miss
vec3 bgFog = deepColor(bgT + layerCycle + fieldDetail * 0.06, vec3(0.00, 0.11, 0.15))
           * (0.04 + bgN * 0.025 + fieldDetail * 0.008 + uCoreEnergy * 0.018) * bgDepthFade;
```

Also reduce line 917 from `depthFog * 0.024` → `depthFog * 0.010` to suppress the second background color layer.

### Step 2 — Bias glow toward organism proximity; reduce ambient spread

**Target:** Lines 909–914

`glow` uses `exp(-minD * 0.95)` which falls off quickly — good. But it's then multiplied by a fixed `glowStr = mix(0.13, 0.07, depth01)` which still emits faint light everywhere in the miss region (depth01 ranges 0→1 for misses). Add a proximity gate so the glow is concentrated near the organism silhouette:

```glsl
// BEFORE (line 909–910)
float glowStr = mix(0.13, 0.07, depth01) * (0.92 + atmosphereDensity * 0.16);
float glow    = exp(-minD * 0.95) * glowStr * (0.085 + audioAtmosphere * 0.12 + ...);

// AFTER
float glowStr = mix(0.11, 0.035, depth01) * (0.92 + atmosphereDensity * 0.16);
float glow    = exp(-minD * 1.35) * glowStr * (0.085 + audioAtmosphere * 0.10 + ...);
```

Raising the `minD` decay from `0.95` to `1.35` sharpens the glow halo around the organism edge. Lowering `glowStr` far-depth from `0.07` to `0.035` cuts ambient spill.

### Step 3 — Gate vein bleed off miss region; tighten atmospheric color

**Target:** Lines 1053–1058

`veinAtmosphereMask` currently bleeds veins across the entire miss region whenever `proxGlow` is nonzero. Add a depth gate so veins only appear near the organism, not across the whole background:

```glsl
// BEFORE (line 1054)
float veinAtmosphereMask = missMask * smoothstep(0.06, 0.42, proxGlow) * 0.18 + veinTunnelMask;

// AFTER
float veinProxGate = smoothstep(0.12, 0.55, proxGlow) * smoothstep(0.65, 0.20, depth01);
float veinAtmosphereMask = missMask * veinProxGate * 0.12 + veinTunnelMask;
```

This keeps veins appearing as organic strands near the organism silhouette and in tunnel regions, but not as a crawling overlay across the far background.

---

## Files To Change

- `src/shaders/psychedelic.frag`
  - Lines 909–910: `glowStr` and `glow` decay tuning
  - Line 912: `bgFog` base + `bgN` modulation + add `bgDepthFade`
  - Line 917: `depthFog * 0.024` → `depthFog * 0.010`
  - Lines 1053–1058: `veinAtmosphereMask` proximity gate

No JS changes. No new uniforms. No render pass changes.

---

## Rollback Strategy

All four changes are constant/coefficient adjustments within existing expressions. Rollback is:
- Revert `glowStr` to `mix(0.13, 0.07, depth01)`
- Revert `glow` decay from `1.35` back to `0.95`
- Revert `bgFog` multipliers to `(0.15 + bgN * 0.080 + fieldDetail * 0.030 + ...)`
- Remove `bgDepthFade` multiplication
- Revert line 917 coefficient from `0.010` to `0.024`
- Revert `veinAtmosphereMask` to original line 1054

`git diff src/shaders/psychedelic.frag` will be ~8 lines. No state, no uniforms, no architecture.

---

## Expected Visual Result

- **Background**: Near-black with faint depth-modulated fog bleeding outward from the organism. Far regions are almost dark. Only the tunnel/portal rings and organism glow illuminate the space.
- **Organism edge**: Sharper inner halo, brighter and more focused around the silhouette — reads as bioluminescent edge rather than a haze spreading across the whole canvas.
- **Veins**: Concentrated near the organism and tunnel structure, not appearing mid-air across the full frame.
- **The organism reads as a thing IN space**, not a thing on top of a patterned background.

The tunnel compositing (Steps 11, lines 921–999) is untouched — that content stays and fills depth behind the organism correctly.

✅ Stage 1 — background fog/flow reduction
✅ Screenshot-tuned fog/flow background falloff and vein bleed tightening
✅ Gated diagnosed wall-cell tunnel contribution out of far miss background
✅ Unified organism field pass — shared cap/rim/throat/gill/membrane/environment masks now drive surface shading, tunnel/fractal reveal, fog/vein/procedural gates, internal glow, biological audio mapping, and spore proxy radii without changing render order, passes, targets, modes, controls, or particle architecture
✅ Final hierarchy tuning — broad blob/shell surface dimmed via throat/gill/rim gating while existing tunnel fog, Mandel ribs/rings/membrane, throat flash, depth travel, and uAudioDriveA/B response were lifted so tunnel structure wins without new systems
✅ Ring integration + low-volume reactivity pass — adaptive render-loop visual lane gain now lifts quiet-but-musical tunnel response while silence stays calm; portal bloom and Mandel rings are rib-broken/absorbed into throat depth, broad shell surface is further dimmed/desaturated, and Spiral motion now leans on tunnel travel/torsion rather than a static halo.
✅ Final psytrance travel/chroma pass — existing tunnel/rib/ring/vein layers now get stronger color, exposure, forward-depth travel, elastic bass/mid/flux response, and quiet-musical motion lift while broad shell shading stays suppressed.
✅ Audio calibration + beat-locked travel pass — DEV lane stats now expose real analyser ranges, bass/mid/motion lanes are normalized hotter, bassPunch gets an elastic render-loop envelope, and existing tunnel-only travel/chroma/definition consumers are stronger without brightening the broad shell.
