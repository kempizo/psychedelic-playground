---
name: add-control
description: Add a new user-facing control end-to-end — wires Zustand defaults, ControlPanel UI, render-loop uniforms or particle/trail handling, URL share params, preset defaults/ranges, and shader declarations where needed. Use when the user wants to expose a visual parameter as a control.
argument-hint: [name] [min] [max] [default]
allowed-tools: Read, Edit, Grep
---

# Add a new control end-to-end

Wires a new user control (`$ARGUMENTS`) through every layer of the app so it's actually usable. Skipping any layer leaves it broken in a non-obvious way.

## What this changes

Usually six or more files, in this order:

1. **`src/store/useStore.js`** — add field with default value to the store object.
2. **`src/components/ControlPanel.jsx`** — add a row to the `CONTROLS` array.
3. **`src/hooks/useThreeScene.js`** — read the control in `tick()` and wire it to the existing render, trail, or particle path.
4. **Shader file as needed** — usually `psychedelic.frag`, but trail controls may use `trail.frag` and particle controls may use `particle.vert` / `particle.frag`.
5. **`src/utils/shareUtils.js`** — add the key to `KEYS`, `DEFAULTS`, and `RANGES` so it survives URL save/share safely.
6. **`src/utils/presetUtils.js`** — add the key to preset defaults and mutation ranges when the control should save/load/mutate.

## Naming conventions

- Store key + URL param: `camelCase` (e.g. `chaos`, `colorShift`, `bassBoost`).
- GLSL uniform name: `u` + `PascalCase` (e.g. `uChaos`, `uColorShift`, `uBassBoost`).
- Slider label in UI: `Title Case` (e.g. `Chaos`, `Color Shift`, `Bass Boost`).

If the user provided `$ARGUMENTS`, parse them as: `[name] [min] [max] [default]`. If not provided, ask the user before doing anything else.

## Step-by-step

### 1. Store

In `src/store/useStore.js`, add inside the create() body alongside other controls:
```js
<name>: <default>,
```

### 2. UI — ControlPanel

In `src/components/ControlPanel.jsx`, add to the `CONTROLS` array:
```js
{ key: '<name>', label: '<Title Case Label>', min: <min>, max: <max>, step: 0.01 },
```

Then add `<name>` to the destructured store hook call and the `values` object on the same line.

### 3. Three.js uniform — useThreeScene

In `src/hooks/useThreeScene.js`:

Add to the relevant uniforms object when the control needs a shader value:
```js
u<PascalName>: { value: <default> },
```

Inside `tick()`, after the existing uniform updates:
```js
mainUniforms.u<PascalName>.value = <name>
```

Make sure to also destructure `<name>` from `useStore.getState()` at the top of `tick()`.

If the control affects trail decay, particles, camera smoothing, or spawn logic, wire it into that existing path instead of forcing it through `psychedelic.frag`.

### 4. Shader

In the shader that actually consumes the value, add the uniform declaration near the top:
```glsl
uniform float u<PascalName>;
```

Then use it where it matches the parameter's purpose. If the user didn't specify what the parameter should do visually, ASK before guessing — wiring a uniform that does nothing is worse than no uniform.

### 5. URL share

In `src/utils/shareUtils.js`:

Add to `KEYS`:
```js
'<name>',
```

Add to `DEFAULTS`:
```js
<name>: <default>,
```

Add a matching range to `RANGES`. If the value is an integer (like `mode`), also update the `deserialize` parseInt branch.

### 6. Presets

In `src/utils/presetUtils.js`, add the control to `PARAM_DEFAULTS`. If `mutatePreset()` should vary it, also add a `RANGES` entry. If the control is saved but should never mutate, leave it out of mutation ranges and document why.

## Verify

After all edits, run:
```bash
npm run build
```

If the build succeeds, the wiring is good — the slider will appear, drive the uniform, and serialize to the URL. If the user wants to test live, they can run `npm run dev` and check the slider visibly affects the shader.

## Reference

Existing controls (`speed`, `intensity`, `colorShift`, `chaos`, `trailDecay`, `cameraDistance`, `procIntensity`, `particleDensity`) are examples. Read similar controls across store, UI, render loop, shaders, URL sharing, and presets before adding a new one.
