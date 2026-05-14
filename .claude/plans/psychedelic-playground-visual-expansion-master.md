# Psychedelic Playground — Visual Expansion Master Plan

> **Canonical single-file plan.** This document consolidates the prior staged expansion plan (Stages 0–11, all shipped passes through 2026-05-13) with the **current Visual Merge Pass** as the next priority. Either Claude Code or Codex can pick up implementation directly from this file.
>
> **Reading order**:
> 1. **Part 0** — operating contract (preserved guardrails, references, audio map).
> 2. **Part I** — the **Visual Merge Pass** (current priority — execute next).
> 3. **Part II** — completed stage history (1–11) — reference only, do not re-run.

---

## Part 0 — Operating Contract

### 0.1 Purpose

Psychedelic Playground is a browser-only audio-reactive visual instrument. After 14+ shipped visual passes, the technical foundation is sound — the next pass is **cohesion**: fuse Mandelbrot, gills, tunnel, cellular veins, spores, and trails into one living portal organism rather than stacked decorative layers.

### 0.2 Project Context

- Stack: React 19, Vite, Three.js, Zustand, Tailwind 3, Web Audio API. No backend.
- Shaders loaded as raw GLSL via `?raw`; edit `.vert` / `.frag` directly.
- Render order is fixed: `main shader -> trail accumulation -> screen -> CPU particles`.
- Render loop lives in `src/hooks/useThreeScene.js` and owns Three.js setup, uniforms, render targets, smoothing, forces, gestures, and particles.
- Audio analysis lives in `src/audio/*` and `src/hooks/useAudioAnalyser.js`; high-frequency audio snapshots written via `useStore.getState().setAudioData(...)`.
- Public mode IDs are stable: `0 Fluid`, `1 Radial`, `2 Vortex`, `3 Collapse`, `4 Orbit`.
- Public controls: `speed`, `intensity`, `colorShift`, `chaos`, `trailDecay`, `cameraDistance`, `procIntensity`, `particleDensity`, `mode`.
- Audio features: `sub`, `bass`, `lowMid`, `mid`, `highMid`, `treble`, `hi`, `rms`, `energy`, `energyEnvelope`, `predictedEnergy`, `onset`, `bassPulse`, `midPulse`, `treblePulse`, `beatPhase`, `beatConfidence`, `spectralCentroid`, `spectralFlux`, `silence`.

### 0.3 Locked Guardrails (apply to every slice)

- No backend, runtime dependency, new UI control, URL/share key, preset schema field, mode ID, render pass, render target, GPU particle system, full fluid sim, or true reaction-diffusion system.
- Preserve render order. Preserve `RawShaderMaterial` `precision highp float;`. Preserve `uMode` / `uPaletteFamily` as `int`, `uPaletteFamilyBlend` as smoothed `float`.
- Audio data stays out of React render state (use `useStore.getState()`).
- Particles stay CPU-driven with `MAX_PARTICLES = 128`, `THREE.Points`, additive last.
- Keep procedural work outside the raymarch loop unless it replaces existing equal-or-lower-cost work.
- Do not undo stabilization (no stroke-like glow, no slider/mode pop, no silent runaway, no ghost clash, no seam regression).
- Silence trends calm; audio gradually wakes the system.
- Each shipped slice stays focused, reversible, and visually verifiable. Append one dated `✅` line to `PLAN.md` per slice.

### 0.4 Audio Role Map (canonical)

| Band / signal | Owns |
|---|---|
| `sub` | slow breathing, camera drift, tunnel depth bend |
| `bass` / `bassPulse` | body/pressure, organism expansion, trail preservation |
| `lowMid` | blob thickness, SDF displacement, low-side warp |
| `mid` / `midPulse` | folding, twisting, gill opening, secondary warp |
| `highMid` | vein contrast, cellular edge reveal |
| `treble` / `hi` / `treblePulse` | micro-ridges, shimmer, sparkle, chromatic trail split |
| `spectralCentroid` | palette phase / color heat direction |
| `spectralFlux` / `onset` | transient bursts, growth wave launches, controlled release |
| `silence` | reduce warp / jitter, slow autonomous drift only |
| `audioPresence` (derived) | smoothed envelope; gates onset accents and lifts atmosphere/particle |

Bass owns body. Mids own morphology. Highs own shimmer. No single band may independently produce chaotic global motion — coordination flows through Stage 4 derived controls.

### 0.5 Reference Direction

Use as motifs, not copied code:

- The Book of Shaders: fBM, domain warping, cellular noise, smoothstep layer composition.
- Inigo Quilez: domain-warped fields, cosine palettes, smooth Voronoi, voronoise.
- MDN / Web Audio `AnalyserNode`.
- Three.js render targets, `DataTexture`, `BufferGeometry`.

Seed links: `iquilezles.org/articles/{warp,palettes,smoothvoronoi,voronoise}`, `thebookofshaders.com/{12,13}`, `developer.mozilla.org/.../AnalyserNode`, `threejs.org/docs`, `threejs.org/manual/.../rendertargets.html`.

### 0.6 QA & Acceptance (applies to every slice)

- After each implementation checkpoint: `npm run lint`, `npm run build`, `git diff --check`. Known Vite large-chunk warning only.
- Visual QA across: no audio, quiet, bass-heavy, treble-heavy, transient-heavy, all five modes, drag force, UI click isolation, fullscreen with `H`.
- Capture calm / mid / peak / afterglow screenshots via `scripts/slice-verify.mjs`.
- Puppeteer console + page-error lists must be empty.
- Performance: no obvious desktop frame collapse; reduce or disable instability via planned internal constants and keep stable work.
- Silence test (30–60s, no audio): scene reads dormant/breathing, not crawling.
- Wake test: audio gradually escalates without any single band triggering chaos.
- UI readability: ControlPanel and EnergyIndicator remain legible.

---

## Part I — Visual Merge Pass (CURRENT PRIORITY)

**Goal**: fuse all shipped layers (Mandelbrot, gills, tunnel, cellular veins, spores, trails, palette) into one coherent audio-reactive psychedelic simulation. Address the "stacked / pasted" feeling while preserving every architectural guardrail.

### I.1 Master-Plan Conflicts in Shipped Code (correct as part of this pass)

The Stage 11 ledger states tunnel "reuses Stage 1's warped `fieldUV`, no second domain warp" and that Mandelbrot uses bounded portal/gill sampling. Code audit found three divergences:

1. **Tunnel does not share the warped field basis.** `tunnelUV` at [src/shaders/psychedelic.frag:921](../../src/shaders/psychedelic.frag#L921) is built from raw screen UV; only a polar spiral rotation is applied. Tunnel rings therefore do not breathe with the organism.
   - **Correction**: soft lerp `tunnelUV` ~15–22% toward `fieldUV` *before* the polar transform. Polar log-depth and seam-safe spiral remain intact.

2. **Mandelbrot portal adds its own domain warp.** [src/shaders/psychedelic.frag:933-938](../../src/shaders/psychedelic.frag#L933-L938) injects an `fbm`-driven rotation into `mandelPortalUV`. This is the hidden "second warp" the master plan forbids and a major cause of the "fractal pasted on the room" read.
   - **Correction**: replace FBM rotation with deterministic `rot(tunSpiral × 1.2 + growthAmp × 0.6 + time × 0.04)` so the portal Mandelbrot rotates in lock-step with the tunnel spiral and growth wave.

3. **Three different `cellularEdge` input coordinates.** Core vein at [src/shaders/psychedelic.frag:873-874](../../src/shaders/psychedelic.frag#L873-L874) uses model-space `p.xy`, wall cells at [:954](../../src/shaders/psychedelic.frag#L954) use `tunnelUV`, atmospheric veins at [:1013-1016](../../src/shaders/psychedelic.frag#L1013-L1016) use `fieldUV`. Three coord bases → three crawl rhythms that never agree.
   - **Correction**: derive all three from `fieldUV` with per-zone scale + offset constants only.

4. **`uOnset` declared but never read in the fragment shader.** Onset reaches the shader only via CPU-smoothed `uEngineD.w` (`onsetAccent`). Dead surface area — flag for cleanup, not blocking.

### I.2 Disconnection Diagnosis

| Symptom | Root cause | File / line |
|---|---|---|
| Mandelbrot reads as "fractal pasted over the room" | Portal Mandelbrot uses its own FBM-rotated UV, untethered from `fieldUV` and from gill-side Mandelbrot's model-space coord | psychedelic.frag:933-938, 941 |
| Tunnel rings sit *behind* the organism but do not feel *of* it | `tunnelUV` is raw screen UV; no shared warp basis with surface | psychedelic.frag:921, 929 |
| Cellular veins, wall cells, core vein crawl at different rates | Three independent input UVs for the same `cellularEdge` helper | psychedelic.frag:873, 954, 1013 |
| Spores spawn in mode-coupled corridors but don't visibly emerge from gill openings or portal throat | CPU particle spawn has no spatial knowledge of shader masks | useThreeScene.js:1156-1189 |
| Phases produce quantitative differences (more spore, more bloom) but the same layers are always on | `phaseMul` table scales 5 parameters; no phase explicitly suppresses Mandelbrot in idle or cellular in peak | useThreeScene.js:849-875 |
| Mandelbrot palette tint can drift away from organism palette family | `mandelPalette` ([:273-278](../../src/shaders/psychedelic.frag#L273-L278)) does not consume `uPaletteFamilyBlend` | psychedelic.frag:273-278, 865, 952 |

### I.3 Already working — do not touch

- **Trail (`trail.frag`)** — luminance-aware decay, orphan crushing, audio-gated chroma shear. Stage 11 Phase 4 is conditional and not needed.
- **Palette family blend** (`uPaletteFamilyBlend`) and the cosine palette grammar — solid; the merge extends it, doesn't replace it.
- **Growth wave** (`uTunnelB.zw`) — already binds onset/mid pulses to membrane motion across organism + tunnel + spores.
- **Engine A/B/C/D vec4 packing** — preserves uniform surface; merge piggybacks on this.
- **`MAX_PARTICLES = 128`**, fixed buffers, additive last — locked.
- **Seam fix** (2026-05-12 polar branch-cut elimination) — soft tunnel coord coupling must preserve it (lerp lives *before* polar).

### I.4 Merge Strategy

#### I.4.a Shared coordinates

Two canonical bases:

- **`organismField`** — `fieldUV` ([:564](../../src/shaders/psychedelic.frag#L564)). Used by surface detail, atmosphere, proximity glow, off-body cellular veins, procedural arcs, **and** as a soft offset for the tunnel basis and for **both** Mandelbrot call sites.
- **`portalField`** — `tunnelUV` after soft lerp into `fieldUV` (~0.18) and polar transform via `tunnelCoords`. Used by tunnel rings, wall cells, portal Mandelbrot, growth wave tint.

Per-layer scale + offset constants only — no second domain warp anywhere.

#### I.4.b Shared mask hierarchy

```
1. base form      sdf hit/miss, depthFog, vignette
2. structural     undersideZone, capZone, rimZone, silhouetteSoft
3. biological     surfaceVeinMask, atmosphereVeinMask (one cellular helper, fieldUV input)
4. fractal        fractalGillMask  = underside × rim × surfaceDetail × audioPresence × phaseMul.mandelReveal
                  portalStructureMask = portalMask × tunDepth × tunInward × audioPresence × phaseMul.mandelReveal
5. emission       energyMask, spark, force glow
6. spore (CPU)    spawned with knowledge of #3/#4 via shader-mirror proxies
7. atmosphere     atmosphereMask, proxGlow, bgFog/bgGlow
```

Every Mandelbrot/cellular contribution multiplies through the relevant level-3 or level-4 mask **and** through `phaseMul.{layerLead}`.

#### I.4.c Shared palette

One master phase `uPalettePhase`. All layers offset from it. Add `uPaletteFamilyBlend` consumption to `mandelPalette` so family transitions reach fractal tint. No new accent families; the five existing (violet, gold, acid, cyan, magenta) cover the merge.

#### I.4.d Audio role tightening (no rewiring)

Audio map already correct (see §0.4). Tightening only:

- Verify `uAudioTurbulence` warp clamp also applies once `mandelPortalUV`'s FBM rotation is removed (Slice 2).
- `uOnset` declaration is dead — defer cleanup; not blocking.

#### I.4.e Phase leadership (extend phaseMul; no new uniforms)

Current `phaseMul` fields: `spore`, `portal`, `tunnelPull`, `trailDecay`, `colorHeat`. Extend by two:

| New field | Drives | idle / breathing / build / peak / afterglow |
|---|---|---|
| `mandelReveal` | multiplied into `fractalGillMask` and `portalStructureMask` via existing `growthAmp` / `bloomEnergy` CPU writes | 0.06 / 0.34 / 0.72 / 1.00 / 0.32 |
| `myceliumReveal` | multiplied into cellular vein amplitude on both surface and atmosphere paths via `surfaceDetail` / `veinReveal` CPU writes | 0.78 / 0.62 / 0.48 / 0.36 / 0.84 |

Phase leadership in plain English:

- **idle-mycelium**: mycelium veins + tunnel atmosphere lead; Mandelbrot nearly invisible; spore sparse.
- **breathing-organism**: organism body breathing leads; tunnel responds slowly; gills begin opening.
- **gills-portal-pull**: gill ribs + portal throat lead; Mandelbrot embedded in throat/rim; spores connect depth.
- **bloom-breakthrough**: portal + spores + edge shimmer lead; Mandelbrot peaks but still masked.
- **afterglow**: trail residue + soft spores + tunnel glow lead; veins return; organism relaxes.

#### I.4.f Particle ↔ shader spatial coupling (CPU proxies)

CPU particles cannot read shader masks. Mirror shader portal/gill geometry CPU-side as cheap proxies:

- `portalRadius = clamp(0.18 + tunPortalTarget × 0.42, 0.18, 0.78)`
- `gillRingRadius = clamp(0.32 + audioMorph × 0.32 + growthWave.amp × 0.18, 0.30, 0.86)`

Bias spawn position for fractal / growth-wave / tunnel spores toward these radii (with tangential scatter ≥ 0.18 of radius to avoid symmetric orbits). Dust/ember spawn unchanged.

#### I.4.g Trail integration

Do not touch `trail.frag`. The merge binds trails by giving them **meaningful structures to remember**: tighter masks → trails preserve gill ridges, portal throat, spore trails rather than smearing whole regions. Luminance-aware kick already prefers midtone (atmospheric) over highlight (cap bloom), which is what we want.

If muddiness appears after Slices 2–5, only then consider Stage 11 Phase 4.

### I.5 Implementation Slices

Seven slices, smallest first, each reversible. Append one dated `✅` line to `PLAN.md` per shipped slice (or one bundled line for the whole merge).

#### Slice 1 — Baseline lock & audit (no edits)

- **Files**: none edited; `PLAN.md` gets one note row documenting the three §I.1 conflicts.
- **Systems**: documentation only.
- **Expected diff**: zero shader changes; one `PLAN.md` row.
- **Risks**: none.
- **Verify**: `npm run lint`, `npm run build`, `git diff --check` all green on clean tree before Slice 2.
- **Tunables**: none.

#### Slice 2 — Shared coordinate unification

- **Files**: `src/shaders/psychedelic.frag`.
- **Systems**: tunnel basis, Mandelbrot portal basis, cellular vein basis.
- **Changes**:
  1. In `main()` just before line 921, compute `tunnelUV = mix(rawTunnelUV, fieldUV, COORD_COUPLE)` where `COORD_COUPLE` is a `const float` (start 0.18, range 0.10–0.25). No new uniform.
  2. Replace `mandelPortalUV`'s FBM rotation ([:934-938](../../src/shaders/psychedelic.frag#L934-L938)) with `rot(tunSpiral × 1.2 + growthAmp × 0.6 + time × 0.04)`.
  3. Switch `coreVeinUV` ([:873](../../src/shaders/psychedelic.frag#L873)) and `wallCells` input ([:954](../../src/shaders/psychedelic.frag#L954)) to `fieldUV` with per-zone scale constants; preserve per-zone amplitude tuning.
- **Expected screenshot diff**: tunnel rings breathe gently with organism; Mandelbrot portal no longer feels separately-warped; vein crawl on body and in atmosphere shares one rhythm.
- **Risks**: (a) overdone coupling blurs polar log-depth → keep `COORD_COUPLE ≤ 0.25`; (b) deterministic rotation looks mechanical → blend `tunSpiral × growthAmp` weighting so it varies with audio.
- **Verify**: Puppeteer captures at silence, build, peak, afterglow + modes 0–4 vs current baseline. Seam test: no `atan` branch-cut regression at left edge.
- **Tunables**: `COORD_COUPLE` (0.18), Mandelbrot rotation gain (1.2), growth coupling (0.6), per-zone cellular scale constants.

#### Slice 3 — Mask hierarchy cleanup

- **Files**: `src/shaders/psychedelic.frag` only.
- **Systems**: `fractalGillMask`, `portalStructureMask`, `veinSurfaceMask`, `veinAtmosphereMask`, `proxGlow`.
- **Changes**:
  1. Top of surface-hit branch: alias `undersideZone`, `capZone`, `rimZone`, `silhouetteSoft` into named locals for clarity (no behavioral change).
  2. `fractalGillMask` ([:861](../../src/shaders/psychedelic.frag#L861)): tighten to `undersideZone × rimZone × audioPresence × gillOpen × phaseMandelReveal` (phase scalar arrives via existing `growthAmp` CPU multiply).
  3. `portalStructureMask` ([:949](../../src/shaders/psychedelic.frag#L949)): require `tunDepth × tunInward × audioPresence` in addition to existing radial + intensity gate.
  4. Cellular helper called once per zone with shared input basis (Slice 2 enables this).
  5. Reuse `audioPresence` (via `uEngineB.y`) as multiplicative gate on Mandelbrot, cellular, procedural, energy filaments. Currently inconsistent.
- **Expected diff**: idle silence — Mandelbrot and cellular nearly disappear; gentle organism breathing remains. Bass-heavy — body responds, portal opens, no full-frame fractal wash. Treble-heavy — vein crawl + spark, no global brightness lift.
- **Risks**: over-gating could deaden peak; counterbalance with phase multipliers (Slice 4).
- **Verify**: idle/calm/build/peak/afterglow captures; confirm fractal detail masked off-body in idle.
- **Tunables**: `audioPresence` exponent (start 1.0), per-mask gate floors.

#### Slice 4 — Phase leadership extension

- **Files**: `src/hooks/useThreeScene.js`, `src/shaders/psychedelic.frag` (read-side multipliers only).
- **Systems**: `phaseMul` table; CPU writes into `growthAmp`, `bloomEnergy`, `surfaceDetail`, vein-amplitude-feeding writes.
- **Changes**:
  1. Extend `phaseMul` ([useThreeScene.js:849-875](../../src/hooks/useThreeScene.js#L849-L875)) with `mandelReveal` and `myceliumReveal` per the §I.4.e table.
  2. Where the render loop writes `uTunnelB.w` (growthAmp) and `uEngineC.x` (bloomEnergy), multiply by `phaseMul.mandelReveal`.
  3. Where it writes `uEngineC.w` (surfaceDetail) and the vein-amplitude-feeding chain, multiply by `phaseMul.myceliumReveal`.
  4. Optionally extend DEV global `window.__JOURNEY_PHASE_MUL__` with the two new keys for Puppeteer assertions.
- **Expected diff**: phase transitions show *which layer is salient*, not just intensity. Idle = mycelium hum; peak = portal + spores + Mandelbrot rim.
- **Risks**: too aggressive suppression makes idle feel dead → keep `myceliumReveal ≥ 0.36` always.
- **Verify**: 5 captures (one per phase) — eye-check each phase has a different dominant layer.
- **Tunables**: 10 numbers (two new fields × five phase targets).

#### Slice 5 — Particle spatial coupling

- **Files**: `src/hooks/useThreeScene.js`; optionally `src/shaders/particle.vert` (verify only; likely no edit).
- **Systems**: fractal/tunnel/growth-wave spore spawn positions; particle palette phase verification.
- **Changes**:
  1. Compute CPU proxies per frame: `portalRadius`, `gillRingRadius` (formulas in §I.4.f).
  2. Bias fractal spore spawn ([useThreeScene.js:1184-1189](../../src/hooks/useThreeScene.js#L1184-L1189)) toward `portalRadius`.
  3. Bias growth-wave spore spawn ([useThreeScene.js:1156-1158](../../src/hooks/useThreeScene.js#L1156-L1158)) toward `gillRingRadius` with tangential scatter (already partial; tighten radius).
  4. Bias tunnel spore spawn ([useThreeScene.js:1178-1182](../../src/hooks/useThreeScene.js#L1178-L1182)) to mid-depth annulus between portal and gill radii.
  5. Verify `particle.vert` `microCycle` already includes `uPalettePhase` (it does via `uMandelPhase`); no edit unless drift visible.
- **Expected diff**: spore bursts visibly emerge from gill ring on growth waves; fractal spores cluster around portal throat; tunnel spores fill the depth band between them.
- **Risks**: too-tight clustering reads as a ring → keep tangential scatter ≥ 0.18 of radius; avoid symmetric orbits per master plan.
- **Verify**: build/peak captures — spore distribution traces portal/gill geometry, not random scatter.
- **Tunables**: radius gains (0.42, 0.32, 0.18), scatter widths.
- ✅ 2026-05-13: implemented CPU proxy radii for portal throat, gill ring, and tunnel band; growth-wave spores now emerge from the gill annulus, tunnel spores fill the band between portal/gill radii, and fractal spores cluster around the portal throat without adding buffers, uniforms, controls, passes, targets, dependencies, or shader edits.

#### Slice 6 — Palette family propagation

- **Files**: `src/shaders/psychedelic.frag`.
- **Systems**: `mandelPalette()` and any palette helper that ignores `uPaletteFamilyBlend`.
- **Changes**:
  1. `mandelPalette` ([:273-278](../../src/shaders/psychedelic.frag#L273-L278)): add `uPaletteFamilyBlend × 0.20` into the phase argument so family transitions propagate to fractal tint without disturbing heat.
  2. Audit `zoneColor` / `deepColor` calls inside Mandelbrot blocks ([:865](../../src/shaders/psychedelic.frag#L865), [:952](../../src/shaders/psychedelic.frag#L952)) — confirm anchor families align with particle anchors.
  3. No change to base cosine palette; no new accent families.
- **Expected diff**: family-blend transitions coherent across organism + Mandelbrot. Fractal tint shifts with the family rather than locking to a fixed phase.
- **Risks**: minimal.
- **Verify**: capture during a family transition (mode change); fractal hue rotates with organism.
- **Tunables**: family-blend gain (0.20).
- ✅ 2026-05-13: propagated the smoothed palette-family phase into `mandelPalette()` with the planned `0.20` gain so both gill Mandelbrot and portal Mandelbrot tint rotate with the organism/particle palette during family transitions, without adding uniforms, controls, palette families, render passes, targets, dependencies, or changing the base cosine palette.

#### Slice 7 — QA & capture comparison

- **Files**: none; uses `scripts/slice-verify.mjs`.
- **Systems**: verification only.
- **Captures** at `http://127.0.0.1:5175/` (or current Vite port):
  - 5 phases × Mode 0: idle, breathing, build, peak, afterglow.
  - 5 modes at peak: 0, 1, 2, 3, 4.
  - 2 audio profiles: silent 60s soak, bass-heavy 15s, treble-heavy 15s, transient-heavy 15s.
  - Compare against `screenshots/refine-*` and `screenshots/slice6-*` baselines.
- **Acceptance**:
  - No black screen, no shader compile errors, empty Puppeteer console/page-error lists.
  - No left-side seam regression.
  - Idle 60s: dormant/breathing, no crawling, no fractal wallpaper.
  - Peak: portal + spores + gill Mandelbrot all present together, not flat full-frame.
  - Trail not muddier than baseline (subjective). If muddy → Stage 11 Phase 4.
- **Verify**: `npm run lint`, `npm run build`, `git diff --check`.
- **Ledger**: append one dated `✅` line to `PLAN.md` for the merge.
- ✅ 2026-05-13: ran the dedicated Slice 7 phase/mode verification pass with `scripts/slice-verify.mjs`, covering Mode 0 phase profiles and all five modes at peak; verifier returned empty `errors` arrays, static checks passed, and spot-checked idle/portal/peak screenshots showed no black screen or left-side seam regression. The long afterglow profile capture decayed back toward breathing/calm by the sampled frame, so a future tuning pass can refine the scripted verifier profile if afterglow-specific visual evidence is needed.

### I.6 Critical Files & Reusable Utilities

| File | Why it matters |
|---|---|
| [src/shaders/psychedelic.frag](../../src/shaders/psychedelic.frag) | All coordinate, mask, palette work (Slices 2, 3, 6). |
| [src/hooks/useThreeScene.js](../../src/hooks/useThreeScene.js) | Phase multipliers, particle spawn, growth wave (Slices 4, 5). |
| [src/shaders/particle.vert](../../src/shaders/particle.vert) | Verify palette phase sync (Slice 5). Likely no edit. |
| [src/shaders/trail.frag](../../src/shaders/trail.frag) | Do not touch. Stage 11 Phase 4 only if Slices 2–5 cause muddiness. |
| [scripts/slice-verify.mjs](../../scripts/slice-verify.mjs) | Phase + mode capture matrix (Slice 7). |
| [PLAN.md](../../PLAN.md) | Ledger; one `✅` line per shipped slice. |

Reuse, do not rewrite:

- `warpField()` / `fbm2()` — canonical Stage 1 warp.
- `cellularEdge()` — one helper, one input basis after Slice 2.
- `mandelbrotField()` (42-iter) — keep; gate harder (Slice 3), palette-couple (Slice 6).
- `mandelPalette()` — keep; add `uPaletteFamilyBlend` (Slice 6).
- Cosine palette `palette()`, `zoneColor()`, `deepColor()`.
- `tunnelCoords()`, `gillRidges()`, `tunnelLayer()`, `portalBloom()` — input changes only (Slice 2).
- Growth wave (`uTunnelB.zw`) — extend drive via phase multipliers (Slice 4).
- `phaseMul` table & DEV globals — extend, don't replace.
- Particle typed arrays — unchanged; only spawn position math shifts (Slice 5).

### I.7 Non-Goals (explicit)

- ❌ No new render pass, render target, ping-pong buffer, or pipeline change.
- ❌ No new public mode IDs, controls, store keys, URL/share keys, preset fields, or runtime dependency.
- ❌ No new GPU particle FBO, full fluid sim, or reaction-diffusion residue.
- ❌ No full-screen Mandelbrot wallpaper or whole-cap fractal coverage.
- ❌ No global rainbow hue spin; open neon palette family stays locked.
- ❌ No brightness/bloom-only "solution" to cohesion; emission stays authorial accent.
- ❌ No second visual system alongside the shipped pipeline.
- ❌ No `trail.frag` rewrite; Stage 11 Phase 4 only on regression.
- ❌ No `MAX_PARTICLES` change; spawn distribution shifts, not count.
- ❌ No removal of the seam-fixed polar transform; soft coord lerp lives *before* polar.
- ❌ No new uniform (current plan adds zero).

### I.8 End-to-End Verification (after all slices)

1. **Static**: `npm run lint`, `npm run build`, `git diff --check`.
2. **Headless captures** via `scripts/slice-verify.mjs`: phase × mode × audio matrix.
3. **Visual acceptance**:
   - Idle 60s reads as dormant fungal/portal hum.
   - Build phase: gill opening visible, Mandelbrot embedded in rim/throat, spores trace gill ring.
   - Peak: portal bloom + spore burst + fractal rim *together*, not three stacked layers.
   - Afterglow: trail residue carries gill/portal memory; veins return; color rotation slows.
   - All five modes have structural identity, not just palette shifts.
4. **Stabilization regressions blocking**: no stroke glow border, no slider/mode pop, no silent runaway, no trail ghost clash, no seam.
5. **Performance**: no desktop frame collapse. Mandelbrot call count unchanged (2 max). FBM/cellular call counts unchanged.
6. **Ledger**: append dated `✅` to `PLAN.md`.

### I.9 Open Implementation Questions (defer to runtime tuning)

- Exact `COORD_COUPLE` constant (0.18 vs 0.22) — A/B during Slice 2.
- Whether to remove the dead `uOnset` uniform declaration — low priority; defer.
- Whether peak phase needs `myceliumReveal` floor higher than 0.36 — eye-test after Slice 4.

---

## Part II — Completed Stage History (Reference)

> Status snapshot as of 2026-05-13. **Do not re-execute these stages.** They are recorded here so any agent (Claude or Codex) opening this file cold understands what is already shipped before tackling Part I.

### Implementation Status Summary

- ✅ Stage 0 — Fresh context & baseline.
- ✅ Stage 1 — Main shader organic field (FBM, domain warp, kaleido).
- ✅ Stage 2 — Organic atmosphere & depth haze.
- ✅ Stage 3 — Cellular & vein layer.
- ✅ Stage 4 — Mode-specific visual engines + journey state model (Slice 6 named phases shipped).
- ✅ Stage 5 — Trail feedback upgrade (S5/S6 stabilization).
- ✅ Stage 6 — CPU particle cohesion + ecosystem refinement.
- ✅ Stage 11 Phase 1 — Tunnel & portal depth field.
- ✅ Stage 11 Phase 2 — Particle ecosystem refinement.
- ✅ Fungal Journey Slice 6 — named phase multipliers.
- ✅ Focused fungal visual refinement pass.
- ✅ Living Portal / structured psychedelic color upgrade.
- ✅ Mandelbrot-inspired embedded portal/gill/vein/spore detail (2026-05-13).
- ⏳ Stage 11 Phase 4 — trail polish, **conditional only** if Visual Merge Pass causes muddiness.
- ✅ Stage 11 Phase 5 — Fluid/Vortex structural distinction (optional follow-up, 2026-05-13): Fluid now leans into calmer breathing membrane/gill-depth structure while Vortex gets stronger inward spiral/portal pull and a neural lattice accent, all through existing engine/tunnel uniforms and the current three-pass pipeline.
- `[Optional]`: Stage 7 audio `DataTexture`, Stage 8 reaction-diffusion prototype, Stage 9 journey preset system.
- `[Deferred]`: Stage 10 research-only items.

### Shipped Stage Briefs

#### Stage 1 — Main shader organic field
- Conservative `fbm2`, `warpField`, `kaleido` in `psychedelic.frag`.
- Multi-stage warped coords once per fragment before camera/mode shaping; reused for background texture, procedural layer, fog, filaments, mode bias.
- Silence remains stable with slow autonomous drift.

#### Stage 2 — Organic atmosphere & depth haze
- Low-amplitude vapor/mist composited in `psychedelic.frag` using existing warped coords.
- Behind/around blob via existing depth/proximity terms; no new render target.
- Capped amplitude — never dominates blob or smears trail.

#### Stage 3 — Cellular & vein layer
- One lightweight 3×3 `cellularEdge` helper on already-warped coords.
- Revealed via `uProcIntensity`, `uHighMid`, `uTreble`, `uTreblePulse`, `uOnset`; reduced during `uSilence`.

#### Stage 4 — Mode engines + journey state
- Internal smoothed engine weights (`uEngineA/B/C/D` vec4 packing) mapped to existing modes (Fluid → Organic Tunnel; Radial → Liquid Mandala; Vortex → Neural Bloom; Collapse → Mycelium Pulse; Orbit → Plasma Creature).
- Render-loop-local derived controls: `audioPresence`, `journeyIntensity`, `calmMotion`, `bloomEnergy`, `warpDepth`, `atmosphereDensity`, `particleActivity`, `trailPersistence`, `surfaceDetail`, `tunnelPull`.
- Slice 6 named phases (`idle-mycelium`, `breathing-organism`, `gills-portal-pull`, `bloom-breakthrough`, `afterglow`) ease over ~1.2s with `phaseMul` table gating spore, portal, tunnelPull, trailDecay, colorHeat.
- DEV globals `window.__JOURNEY_PHASE__`, `window.__JOURNEY_PHASE_MUL__` for Puppeteer verification.

#### Stage 5 — Trail feedback
- Upgraded `trail.frag` with luminance-aware `localDecay`, directional smear, treble chromatic split, onset/bass preservation, silence cleanup.
- Behavioral trail-decay tuning in `useThreeScene.js`: `journeyClear = journeyIntensity × 0.10`, `silence × 0.06` persistence boost.
- Within conservative `uDecay` range 0.70–0.94.

#### Stage 6 — CPU particle ecosystem
- `MAX_PARTICLES = 128` preserved.
- Depth-stratified spawn (far dust / mid spores / near embers/pollen), mode-coupled corridors, sustained active-audio spore trickle, silence-damped acceleration.
- Particle shader size/opacity cohesion lightly tuned.

#### Stage 11 Phase 1 — Tunnel & portal depth field
- Added internal `uTunnelA` (depth/inward/gills/spiral) and `uTunnelB` (breath/portalBloom/growthAge/growthAmp).
- Helpers: `tunnelCoords`, `gillRidges`, `tunnelLayer`, `portalBloom`.
- Spiral applied as pre-polar UV rotation to eliminate `atan` branch-cut seam.
- Atmosphere envelope lifted from flat 0.035 to journey-modulated.
- Blob exposure floor 0.52 → 0.46.
- Per-mode tunnel character via `uEngineA/B/C/D` + `uModeBlend`.

#### Mandelbrot-inspired embedded detail (2026-05-13)
- 42-iteration `mandelbrotField()` helper added with smooth iteration palette tint, orbit-trap, boundary contour.
- Two call sites only: surface gill/rim zones (model-space coord) and portal/tunnel structure (tunnel-space coord with FBM rotation — see §I.1 conflict #2).
- `mandelPalette()` blends cold/hot/violet by `phaseHeat`.
- CPU spore fractal phase bias on particle palette.

### Implementation Preference (legacy order)

Atmosphere (Stage 2) → surface detail (Stage 3) → coordinated particles (Stage 6 refinement) → mode engines + journey state (Stage 4) → trail upgrade (Stage 5). All shipped.

Next: optional verifier-profile tuning for stronger afterglow evidence, or a fresh small visual QA/tuning slice after reviewing the latest `screenshots/stage11-phase5-*` captures.

---

## Source-Of-Truth Notes

- This file is the canonical fresh-session prompt for the visual expansion. `PLAN.md` and `.claude/docs/progress.md` should point here or track ledger status, not duplicate content.
- Future implementation sessions should read this file after `AGENTS.md`, `CLAUDE.md`, and `PLAN.md`, then execute the smallest unshipped optional visual slice or verifier improvement.
- Append one dated `✅` implementation-ledger line to `PLAN.md` after any verified slice.
- Multi-agent handoff: write commits with plain references to slice numbers (e.g. "Merge Pass Slice 2 — Shared coordinate unification ✅"). Either Claude Code or Codex can resume cold from this file.
