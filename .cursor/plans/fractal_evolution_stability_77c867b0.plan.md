---
name: Fractal evolution stability
overview: "Review of commit `92c1543` Mandelbrot/orbit-trap routing in [src/shaders/psychedelic.frag](src/shaders/psychedelic.frag): the anatomy reads well structurally, but several **linear, frame-hot** combinations and one **oscillating ring target** make evolution, zoom, and lattice glints more twitchy than the living-growth goal. **Primary motion goal:** the Mandelbrot field should **grow along the tunnel** (anatomy advances with log-depth / forward-travel phase) rather than **slide over** the portal (2D UV translation + decoupled spin). **Authority hierarchy:** micro (pores/shimmer) must never dominate unless macro (portal/throat contour) and meso (ribs/rings/folds) are active—otherwise the read becomes decorative wallpaper. All proposed fixes stay inside the same file, reuse existing uniforms only, and avoid extra samples or pipeline changes."
todos:
  - id: ring-radius-growth
    content: "In mandelbrotField: retune ringRadius evolution to depth/tunnelPhase-first, reduce sin-LFO beating against trap minima."
    status: pending
  - id: zoom-drive-remap
    content: Remap mandelZoomDrive (bloom/centroid) with smoothstep/pow and blend to slow tunnel-phase baseline for silence/afterglow stability.
    status: pending
  - id: portal-uv-depth
    content: "Reparameterize portal Mandelbrot UV so depth (polarTwarp.z) + forward phase advance the sample like growth along the tube; strip or retarget components that read as 2D slide (decoupled rot2/audio spin on tunnelUV)."
    status: pending
  - id: silence-floor
    content: Raise/ease portalAudioGate (and gill gate if needed) using calmMotion/tunBreath so evolution stays visible when quiet.
    status: pending
  - id: lattice-anatomy-gate
    content: "Enforce micro authority chain: effective micro ~ pointMask * f(macro) * f(meso) * anatomyThroatGate (smoothstep/pow OK); remove lattice mix floor; no standalone sparkle sheet."
    status: pending
  - id: verify-build
    content: Run npm run lint && npm run build; spot-check silence and loud centroid frames.
    status: pending
isProject: false
---

# Mandelbrot coherence pass — review and stabilization plan

## What the committed pass does well

- **Single sample, post-raymarch**: [`mandelbrotField`](src/shaders/psychedelic.frag) (lines ~300–352) respects the budget (`MANDEL_MAX_ITER` unchanged) and keeps fractal work out of the march loop.
- **Trap routing**: Shader scalars `fractalMacroContour`, `fractalMesoLattice`, and `fractalMicroShimmer` (from `boundary`/rings, line×ring, and `pointMask`) are separated before composite into ribs/rings/lattice/membrane (~1207–1252)—good **signal** split, but composite math must still enforce **authority** (see hierarchy below).
- **Tunnel coupling hooks**: `tunnelDepthPhase` / `mandelTunnelPhase` feed center drift and trap phases; [`tunnelUV`](src/shaders/psychedelic.frag) already mixes `rawTunnelUV` with `fieldUV` at `COORD_COUPLE = 0.18` (~930–935), which is the right lever for “portal not wallpaper” without new uniforms.

## Anatomy authority hierarchy (macro / meso / micro)

**Semantic roles (target read, not only trap names)**

- **Macro** — portal body / **throat contour**: large-scale presence of the organism in the tunnel (`fractalMacroContour` from boundary + ring energy, plus gates like `portalStructureMask` / throat contour). If this is weak, the scene should not read as “filled with fractal.”
- **Meso** — **ribs / rings / gills / membrane folds**: corridor and band structure (`fractalMesoLattice`, rib/ring weights, gill traps). This is the connective tissue between macro silhouette and fine detail.
- **Micro** — **pores / shimmer / filaments / edge glints**: `pointMask` / lattice path. High frequency, high sparkle energy—**must be subordinate**.

**Authority rule (user requirement)**

Micro detail must **never** have visual authority unless the larger structure underneath is active. Conceptually, the effective micro drive should be something like:

`microAuthority ∝ fractalMicroShimmer * f(fractalMesoLattice) * g(fractalMacroContour) * h(anatomyThroatGate)`

—not necessarily those exact symbols or all multiplies raw (you may use `smoothstep` bands, `pow` for concavity, or a single combined gate), but **no additive floor** that lets micro show when macro/meso are near zero. If micro can appear without macro/meso, the scene becomes **decorative** again (glitter sheet / overlay), not a living growth field.

**Implementation locus:** after the three scalars are defined (~1207–1216), either (a) define a **`fractalMicroAuthority`** (or fold into `mandelLattice` only) that applies the chain, or (b) multiply `fractalMicroShimmer` by the gates **once** before any path that uses it for color. Ribs/rings/membrane should **not** be forced through the same micro gate unless you intentionally want meso to disappear when macro is weak (usually macro already gates `portalStructureMask`); the critical fix is **lattice / shimmer composites**.

## Growth along tunnel vs sliding (priority)

**What reads as “slide” today**

- Portal `mandelPortalUV` starts from `tunnelUV` then applies `rot2(tunSpiral * 1.2 + growthAmp * 0.6 + uTime * 0.028 + uAudioDriveA.z * 0.40)` (~1176–1177). That rotation plus screen-heavy `tunnelUV` makes the Julia/Mandel slice **shear and spin on the disk** largely independent of the **inward** direction the polar tunnel already encodes in `polarTwarp.z` / `depthTravel` / `forwardSlow`.
- `mandelZoomDrive` leans on bloom/centroid (~1178–1183) more than on a **single forward growth clock** shared with tunnel rings, so `c = center + uv * zoom` can change in ways that feel like the pattern **skates** across UV instead of **unfolding** as you travel deeper.

**What “grow along the tunnel” should mean in-shader (no new uniforms)**

- Treat **`polarTwarp.z` (and/or `mandelTunnelPhase`, `forwardSlow`, `depthTravel`)** as the **primary clock** for portal `mandelbrotField`: pass it into `time` / `tunnelDepthPhase` / ring evolution so trap anatomy and tunnelLayer depth rings share the same **longitudinal** phase—growth rings move with “inward travel,” not a separate LFO.
- **Reparameterize `mandelPortalUV`** so one axis is dominated by **angular tunnel coordinate** (`polarT.y` or stable theta from `tunnelCoords`) and the other by **normalized depth or log-radius** (`polarTwarp.z`, `polarT.x` with gentle remap), with only a **small** residual from screen `tunnelUV` if needed for coverage. Then any `rot2` should be **phase-locked to the same depth clock** (or removed from orthogonal “spin”), not `uAudioDriveA.z` as a free turntable.
- **Zoom (`mandelZoom`)** should track **inward structure** (`tunInward`, `tunDepth`, depth-smoothed drive) so detail increases as the portal throat deepens—audio can modulate **around** that baseline, not replace it (overlaps with zoom-drive todo).

This subsumes the old “portal UV depth lock” bullet: depth lock is necessary but not sufficient; the **dominant derivative** of the fractal with respect to view position/time should align with **tunnel depth**, not tangential screen motion.

## Findings vs your five goals

### 1) Temporal continuity of `fractalMacroContour`, `fractalMesoLattice`, `fractalMicroShimmer`

- **Ring target oscillation**: Inside `mandelbrotField`, `ringRadius` is driven by `sin(time * 0.13 + …)` (~324–326). That **re-targets** the ring orbit trap every frame. Against a fixed iteration cap, the accumulated `trapRing` minimum can change rhythmically in a way that reads as **pulsing bands** rather than smooth growth—especially where `ringMask` and `lineMask` multiply for meso (~1214–1215).
- **Meso as a raw product**: `lineMask * ringMask` spikes in narrow overlap zones; without a mild nonlinearity (e.g. `pow` / `smoothstep` on the product or a minimum contour prior), meso can **twinkle** when audio widens smoothstep bands via `audioDetail` (~347–348).
- **Macro boundary**: `boundary` uses `escaped` as a hard multiplier (~350). Near the escape boundary, small changes in `c` (from zoom/UV) can produce **binary-ish** macro changes; contour energy may pop when zoom moves quickly (tied to goal 2).

### 2) `mandelZoomDrive` vs `bloomEnergy` / `uSpectralCentroid`

Current driver (~1178–1185):

```1178:1185:src/shaders/psychedelic.frag
  float mandelZoomDrive = clamp(
    bloomEnergy * 0.36 + tunPortal * 0.24 + tunInward * 0.16 + cent01 * 0.38,
    0.0,
    1.0
  );
  float mandelZoom = mix(1.34, 0.57, mandelZoomDrive);
  mandelZoom *= 1.0 - 0.12 * uAudioBody;
```

- This is a **linear sum of four terms** then a **wide linear zoom remap** (~0.77 span in `zoom` passed into `c = center + uv * zoom` ~308). `bloomEnergy` (`uEngineC.x`) and `cent01` are both **timbre/engine-class signals** that can move quickly; there is no remapping that **compresses tails** or **prefers slow structural phase** when audio is quiet.
- `uAudioBody` applies another multiplicative step with no shared easing—fine for punch, but stacked with the above it increases “scale explosion” feel on loud frames.

**Shader-only mitigation (no new uniforms):** derive a **zoom authority** scalar from *already slow* tunnel phase signals you already compute: e.g. `polarTwarp.z`, `forwardSlow`, `tunDepth`, and `afterglowSoft`. Use it to **shrink the effective weight** of `bloomEnergy` and `cent01` (or run them through `smoothstep` / `pow` with γ>1) and to **lerp** the raw drive toward a depth-tied baseline in silence/afterglow. That is not temporal IIR, but it **removes the worst frame-hot coupling** the user called out.

### 3) Depth-locked gills/ribs/rings vs screen-space “paste” (and growth vs slide)

- **Portal sample** uses `mandelPortalUV` from `tunnelUV` plus a global `rot2(...)` (~1176–1177). The polar tunnel already encodes depth in `polarTwarp.z` (~1168–1170), but the Mandelbrot UV does not yet **shear** strongly with `(polarTwarp.z, polarT.y)` or log-radius—the fractal still “rides” mostly the same 2D coordinate as the rim.
- **Gill path** (~1043–1057) is materially better locked: angle from `atan(p.z, p.x)` and radial mix with `p.y` / `length(p.xz)` ties the sample to the surface/throat.

**Shader-only mitigation:** implement the **growth-axis reparameterization** above (theta × depth as the main Mandelbrot chart, shared forward clock with `mandelTunnelPhase`). Optionally add a **small** residual offset tied to `depthBend` for organic wobble. **Raise `COORD_COUPLE` slightly** (e.g. 0.18→0.22–0.26) only if the tunnel field still reads as one continuous membrane after the UV change.

### 4) Silence / afterglow: alive but calm

- `portalAudioGate = mix(0.04, 1.0, audioPresence)` (~1196) heavily damps portal Mandelbrot structure in silence; combined with `portalStructureMask` (~1200–1205) the fractal can read **nearly off** even though `uTime` still advances in `mandelbrotField`.
- Afterglow already slows time scaling (`uTime * mix(0.50, 0.28, afterglowSoft)` ~1189) and `shimmerCycle` (~718)—good.

**Shader-only mitigation:** raise the **effective floor** of `portalAudioGate` using existing calm drivers (`calmMotion`, `tunBreath`, `organicTunnel`, `forwardSlow`-derived micro-phase), so silence keeps **slow morph** without restoring full transient sparkle. Mirror the idea on `fractalGillAudioGate` (~1061) only if gills read “dead” in your visual pass.

### 5) Micro shimmer must never become a glitter sheet (hierarchy enforcement)

- `fractalMicroShimmer = portalMandel.pointMask` (~1216) is raw—**full authority** until downstream math clips it.
- `mandelLattice` (~1246–1247) multiplies by `latticeGate`, but the anatomy mix still has a **0.32 floor** toward full lattice weight when meso/macro are weak: `mix(0.32, 1.0, fractalMesoLattice * 0.52 + fractalMacroContour * 0.38)`.

That floor is the main reason micro can **detach** from macro/meso and float as sparse full-portal noise when `pointMask` is broad—**violates** the macro/meso/micro authority rule above.

**Shader-only mitigation:** (1) **Remove** the `mix(0.32, …)` floor entirely. (2) Apply the **multiplicative authority chain** on the micro/lattice path: gate shimmer by **meso**, **macro**, and **`anatomyThroatGate`** (already computed ~1199)—e.g. `smoothstep` each into `(0,1]` then multiply, or `pow(fractalMesoLattice, γ)` to demand stronger meso before pores light up. (3) Optionally `pow(fractalMicroShimmer, >1)` **only** on lattice/shimmer composites to kill broad mid-gray sparkle. Do **not** starve rib/ring **meso** routes unless macro gates already handle absence of body; lattice is the primary consumer of raw `pointMask`.

## Implementation sketch (file scope)

| Area | File | Approach |
|------|------|------------|
| Ring trap continuity | [psychedelic.frag](src/shaders/psychedelic.frag) | Replace or heavily damp the `sin`-only `ringRadius` motion with **slower, monotonic-in-depth** components (`tunnelDepthPhase`, small `time` drift) so ring traps evolve like growth rings, not an LFO. |
| Zoom drive | same | Remap `bloomEnergy`/`cent01` (e.g. `pow`, `smoothstep`, or `min` combinations) and blend raw `mandelZoomDrive` toward a **slow tunnel-phase baseline** using `polarTwarp.z`, `forwardSlow`, `tunDepth`, `afterglowSoft`. |
| Tunnel growth chart | same | Build portal `mandelPortalUV` primarily from **theta + log-depth** (`polarT.y`, `polarTwarp.z`, `polarT.x`); bind `mandelbrotField` `time`/`tunnelDepthPhase` to the same **forward** signals; reduce or rephase `rot2` so it does not act as independent 2D slide over the portal. |
| Silence floor | same | Modulate `portalAudioGate` / gill audio gate floors with `calmMotion` + `tunBreath` (no new signals). |
| Micro authority / lattice | same | Drop lattice `mix(0.32,…)` floor; drive lattice from `pointMask` only through **macro × meso × anatomyThroatGate** (smoothstep/pow variants OK)—micro never standalone decorative. |

## Verification

- Run `npm run lint` and `npm run build` after edits (per your constraint).
- Visual pass: silence (high `uSilence`), loud centroid swings, and kick spikes—watch for zoom continuity, ring band stability, and absence of full-frame pin-lattice when music drops.
- **Growth read:** with fixed camera, inward tunnel motion should advance fractal anatomy **with** depth rings (longitudinal growth); it should not look like a **decoupled texture** skating sideways on the portal.
- **Hierarchy read:** with macro/meso driven low (or throat gate weak), **lattice/shimmer should nearly vanish** even if treble/flux gates are high—no full-frame pin field.

## Out of scope (by your constraints)

- No changes to [useThreeScene.js](src/hooks/useThreeScene.js) or uniform plumbing unless you later decide engine smoothing is insufficient—this plan keeps the contract intact and does all remapping in GLSL.
