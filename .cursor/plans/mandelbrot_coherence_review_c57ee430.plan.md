---
name: Mandelbrot coherence review
overview: Code review of Mandelbrot/orbit-trap integration, guided by the principle that fractal output reads as anatomy (mask- and depth-driven structure), not decoration (full-field tint, glow, or wallpaper). Implementation slice stays shader-side only with no new passes, targets, modes, uniforms, or render-order changes.
todos:
  - id: derive-signals
    content: In psychedelic.frag, after portalMandel sample, add 2–4 derived scalars from MandelTraps that encode contour/fold/shimmer (structure-first), not a generic beauty pass.
    status: completed
  - id: route-masks
    content: Route those scalars into mandelRibs/Rings/Membrane/ringDepthBreak and existing anatomy gates so fractal energy cannot dominate where masks are weak.
    status: completed
  - id: reduce-wash
    content: Cut decorative Mandel contribution (broad membrane tint, neon lift) unless it is gated by anatomy masks; do not add glow to compensate.
    status: completed
  - id: continuity-zoom
    content: Rebalance mandelZoom + center drift toward spectral/tunnel-depth cues and away from bloomEnergy-only coupling; slow harsh UV motion.
    status: completed
  - id: verify
    content: Run npm run lint, npm run build; spot-check screenshots per five-point list.
    status: completed
isProject: false
---

# Mandelbrot / orbit-trap coherence — review and patch slice

## Design principle (non-negotiable for this slice)

**The fractal should be anatomy, not decoration.**

- **Anatomy** means trap-derived signals primarily **modulate or reinforce** existing organism vocabulary: throat, gills, rim, membrane folds, portal void, tunnel depth (`tunnelI`), and gates already in the shader (`portalStructureMask`, `tunnelBlobMask`, `organism.*`). Colour is **secondary**: it should follow structure that is already spatially justified, not sit on top as a second painting.
- **Decoration** (explicitly out of scope for *adding*; in scope for *reducing*) includes: full-frame or ungated **tint washes**, **membrane glow** that does not track fold/boundary structure, **saturation boosts** that flatten micro-contrast, and **scale** that tracks **brightness** (`bloomEnergy`) so louder audio reads as “more fractal wallpaper.”

Implementation must bias **ribs/rings/void/folds** over **untargeted colour add**; any additive Mandel colour should remain **strongest only where anatomy masks are already high**.

## Git and docs

- **Branch / status:** `review/mandelbrot-coherence-pass`, working tree clean; latest commit message references Mandelbrot tunnel work.
- **Ledger:** [PLAN.md](PLAN.md) records the render contract (main → trail → screen → particles) and recent slices (mask hierarchy, shared `fieldUV` coupling, `uAudioDriveA/B` packing in [src/hooks/useThreeScene.js](src/hooks/useThreeScene.js)).
- **Spec:** No `ARCHITECTURE.md` in tree; [AGENTS.md](AGENTS.md) + PLAN + [.claude/plans/visual-coherence-fog-flow-background.md](.claude/plans/visual-coherence-fog-flow-background.md) are the practical references.

---

## Review answers (with file/line anchors)

### 1. Where is Mandelbrot / orbit-trap output calculated?

- **Primary implementation:** `MandelTraps mandelbrotField(...)` in [src/shaders/psychedelic.frag](src/shaders/psychedelic.frag) (struct ~291–298, function ~300–351). Single loop (`MANDEL_MAX_ITER` 42) accumulates escape, **line** orbit-trap (`trapLine`), **ring** trap (`trapRing` with time/audio-morph–modulated radius), and **point** trap (`trapPoint`), then builds masks + `smoothIter`.
- **Call sites (two UV bases):**
  - **Surface gills:** ~1042–1056 → `gillMandel` (post-SDF hit branch only).
  - **Tunnel / portal:** ~1173–1184 → `portalMandel` (runs every frame after raymarch; composited with tunnel stack ~1169+).
- **Related non-Mandel “orbit trap”:** `orbitTrapMask` ~184–197 feeds **filaments** later (~1378+) — different cheap IFS-style trap, not `mandelbrotField`.

### 2. Colouring only vs structure?

- **Not in SDF geometry:** Mandelbrot is **not** inside `sdfBlob` / `sdfOrbit` distance fields. Throat **geometry** still comes from tunnel uniforms + `uAudioDriveA.xy` on the throat carve (~589–592).
- **Structural influence is mostly compositing, not wallpaper SDF:**
  - **Portal path:** `mandelRibs` / `mandelRings` are **added into** scalar `tunnelI` (~1254–1260), so they **modulate perceived tunnel depth/texture** before final colour. `mandelVoid` **multiplies** accumulated colour (~1281). `mandelMembrane` / tint adds are **emissive/colour** on top (~1285–1291).
  - **Gill path:** mostly **additive** tint + small **multiplicative** darkening via `fractalDarkFold` (~1066–1067); ribs/vein terms are surface-local.

### 3. Which masks define anatomy zones?

| Role | Primary symbols (shader) | Approximate location |
|------|---------------------------|----------------------|
| Tunnel polar / portal opening | `portalMask`, `polarT`, `tunnelCoords` | ~358–366, ~941–942 |
| Organism zones (rim, cap, underside, throat, gill, membrane, environment) | `OrganismField` from `getWorldField` | ~415–458; on-hit rebalance ~957–963 |
| Portal / tunnel **structure gate** for Mandel | `portalStructureMask` (portal radial × tunnel intensity × depth × inward × audio × anatomy) | ~1188–1194 |
| Gill fractal zone | `fractalGillMask` = zone × audio × growth gates | ~1057–1061 |
| Final tunnel paint through blob | `tunnelBlobMask`, `tunnelRimAtten` | ~1276–1279 |
| Void (dark interior) | `mandelVoid` × `portalStructureMask` | ~1227–1228, ~1281 |
| Ribs / rings / lattice / membrane (fractal roles) | `mandelRibs`, `mandelRings`, `mandelLattice`, `mandelMembrane` | ~1203–1226 |

### 4. Which audio lanes drive fractal evolution, scale, trap position, colour, flow?

**CPU → uniforms** ([src/hooks/useThreeScene.js](src/hooks/useThreeScene.js) ~1041–1222): `uTunnelA/B` targets blend **subBody** (`sbC`), **bassPunch** (`bpC`), **midMotion** (`mmC`), **fluxPulse** (`fpC`) per mode; `uAudioDriveA` = `subBody, bassPunch, midMotion, highSparkle`; `uAudioDriveB` = `brightness, fluxPulse, motionEnergy, silenceAmount`. `bloomEnergy` (fed to `uEngineC.x`) is scaled by `phaseMul.mandelReveal` (~1003). Growth wave amplitude writes `uTunnelB.w` (~1116–1117).

**GPU `mandelbrotField` parameters** (~300–351, call ~1177–1183):

- **Trap position / morph:** `center` drifts with `sin/cos(time * 0.07x + audioMorph * 1.x)` (~302–305); `c = center + uv * zoom`.
- **Zoom / scale:** `mandelZoom` mixes from `bloomEnergy`, `tunPortal`, `tunInward`, damped by `uAudioBody` (~1175–1176).
- **Trap thickness:** `audioDetail` widens smoothsteps on line/ring/point masks (~346–348).
- **Portal UV flow:** rotation uses `tunSpiral`, `growthAmp`, `uTime`, **`uAudioDriveA.z` (mid motion)** (~1174).

**Tunnel travel / depth phase** (~1154–1157): `forwardSlow/Mid/Fast` combine `tBase`, **`uAudioDriveA.x/z/w`**, **`uAudioDriveB.y/z`** (`fluxPulse`, `motionEnergy`), **`uAudioDriveB.w` (silence)** via `silenceSlow`.

**Palette / separation:** `uSpectralCentroid` in `mandelPalette` / `mandelPortalTint` (~1065, ~1229–1230); `palette()` also uses centroid for temperature (~232–247).

### 5. Fog, bloom, palette wash hiding detail?

- **Surface branch:** `fogColor` mixes on grazing **erode** (~1106–1107) + depth fog (~1108).
- **Miss branch:** `depthFog`, `bgFog`, depth01 mix toward `fogColor` (~1132–1134).
- **Strong neon lift:** `tunnelTint` / `mandelPortalTint` get `saturateNeon(...) * 1.38` / `* 1.28` (~1267–1269) — can **flatten micro-contrast** when tunnel energy is high.
- **Portal bloom:** `portalBloom` + `tunPortal` (~1171–1172, ~1283) — intentionally soft; prior docs note halo risk ([.claude/plans/visual-coherence-fog-flow-background.md](.claude/plans/visual-coherence-fog-flow-background.md)).

### 6. Random / unsynced jumps, harsh resets, noisy temporal change?

- **Discrete events:** `growthWave` **re-launches** when `growthTrigger > 0.20` and timer gap (~1101–1107 in `useThreeScene.js`) — injects **step** energy into `uTunnelB.w` / gates used in shader (`growthAmp`).
- **GPU noise:** `tJitter` on ray (~651) and FBM warps add **high-frequency temporal** variation; not “random” but can read as **sparkle** against slow Mandel phase.
- **Mandel interior:** binary `escaped` → `inside` mask can be **sharp** at the set boundary (inherent to escape test).
- **JS smoothing:** Musical lanes and flux cooldown are documented in PLAN as mitigations for clicks; centroid/flux still hit uniforms that can move quickly on some material.

**Bass / throat:** Sub/bass already **widen the throat SDF** and body radius (~569–572, ~589–592). Mandelbrot **does not** currently compress/expand that throat; it mostly rides on **portal bloom** (`portalBounce` / `bassBounce` ~1171–1172) and **ring** emphasis (~1215–1216).

---

## Gap vs desired “anatomy” direction

- **Good:** Trap channels are already **split by role** (ribs = line, rings = ring, lattice = point, membrane = boundary, void = inside) ~1196–1228; portal Mandel is **gated** by `portalStructureMask` and `tunnelBlobMask`.
- **Gaps (decoration risk):** (a) **Low vs mid vs high** anatomy is mostly **mode weights** (`ribWeight` …) not **frequency-split trap fields**; (b) **zoom** leans on **`bloomEnergy`**, so “fractal scale” can correlate with **brightness** — reads as **effect**, not tissue; (c) **membrane + saturation** can feel like a **lit sheet** over ribs; (d) gill pass is largely **additive colour** (~1067–1068) with weaker **structural** tie than portal ribs in `tunnelI`.
- **Cost:** Two `mandelbrotField` calls (portal + gill) stay; do **not** add a third iteration pass.

---

## Implementation slice (one coherent change-set)

**Scope:** [src/shaders/psychedelic.frag](src/shaders/psychedelic.frag) only unless a one-line uniform mapping bug is found (none expected). **No** new uniforms, modes, passes, targets, or particle shader changes in this slice.

**Acceptance bar:** If a change mostly increases **global colour energy** without increasing **readable fold/rib/throat structure** inside existing masks, it fails the anatomy principle and should be reverted or rebalanced.

**A — Derive 2–4 reusable “anatomy” scalars from existing `portalMandel` (no extra iteration):** immediately after ~1184, define e.g.:

- `fractalMacroContour` — low-spatial-frequency proxy: emphasize `boundary` + softened `ringMask` (portal rim / rib bulk).
- `fractalMesoLattice` — mid: `lineMask * ringMask` or similar to emphasize **intersection** bands (gill-adjacent folds), not either mask alone at full screen.
- `fractalMicroShimmer` — high: keep **`pointMask`** but multiply by existing `latticeGate` / `highSparkle` path so it cannot fire without treble+flux gates (~1217–1222).

**B — Feed into existing masks / compositing:** use those scalars to **modulate weights** already present:

- Scale **`mandelMembrane`** and/or **`membraneContour`** by `fractalMacroContour` so wide glow **tracks** escape boundary structure instead of a flat wash.
- Apply **`fractalMesoLattice`** to **`ringDepthBreak`** / `ringStructureMask` (~1210–1211) or to **`mandelRibs`** depth factor so **mid-frequency** structure reads as **folds**, not independent rings.
- Keep **`mandelLattice`** on `fractalMicroShimmer` only (avoid spreading point-trap across ribs).

**C — Reduce decorative full-fractal coverage (anatomy > tint):** **lower** untargeted contribution: `mandelPortalTint` saturation multiplier (~1269), broad **membrane add** (~1285–1286), and any Mandel colour path that fires when `portalStructureMask` or `anatomyThroatGate` is weak. **Preserve or slightly lift** rib/ring contributions that are already **depth-gated** so the portal still reads as **living tissue**, not a dimmer overlay.

**D — Continuity (shader-only):** reduce coupling of **`mandelZoom`** to `bloomEnergy` in favour of **`uSpectralCentroid`** (already a uniform) + existing `tunInward`/`tunPortal` so scale shifts feel **spectral**, not “brightness = more fractal”. **Slow** center drift coefficients (~302–305) or tie phase to **`polarTwarp.z`** so evolution **locks to tunnel depth** more than raw `uTime` alone. **Do not** add frame-history without new uniforms.

**E — Readability:** tighten **`portalStructureMask`** only if tests show wallpaper (e.g. slightly raise `tunnelI + portalI` smoothstep threshold ~1190), avoiding new geometry.

**Performance:** **Two** `mandelbrotField` calls remain (portal + gill); slice adds **O(1)** ALU per fragment.

---

## Verification (after implementation — per your checklist)

- Run `npm run lint` and `npm run build`.
- **Files changed:** expect **only** [src/shaders/psychedelic.frag](src/shaders/psychedelic.frag) unless a minimal JS fix is unavoidable (unlikely).
- **Before/after intent (short):** Before: Mandel can read as **decorative** (bright membrane/tint and zoom tied to loudness). After: trap output **registers as anatomy** — ribs/rings/void/folds dominate inside **existing** masks; colour **follows** those structures; **no** new glow or wallpaper to compensate.

**Screenshot checklist (Puppeteer / manual):**

1. **Fluid + silence** — tunnel still breathes; no “strobing” lattice; Mandel detail subdued in outer field.
2. **Build / gills-portal-pull** — ribs read as **continuous** with `tunnelI`; rings show **fold bands**, not a second wallpaper layer behind the blob.
3. **Peak + bass-heavy** — throat **opens/closes** (SDF) visibly; portal Mandel **scale** does not simply **blow out** with brightness.
4. **Orbit mode** — left-edge seam still absent; Mandel contribution stays inside `tunnelBlobMask`.
5. **Afterglow** — `afterglowSoft` paths slower Mandel time still feel calm (gill ~1051, portal ~1179).
