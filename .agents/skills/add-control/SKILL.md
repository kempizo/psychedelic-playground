---
name: add-control
description: Add a new user-facing control (slider or toggle) end-to-end — wires the Zustand store, the ControlPanel UI, the shader uniform in useThreeScene, the URL share params, and adds the uniform declaration to psychedelic.frag. Use when the user wants to expose a new visual parameter as a control.
argument-hint: [name] [min] [max] [default]
allowed-tools: Read, Edit, Grep
---

# Add a new control end-to-end

Wires a new user control (`$ARGUMENTS`) through every layer of the app so it's actually usable. Skipping any layer leaves it broken in a non-obvious way.

## What this changes

Five files, in this order:

1. **`src/store/useStore.js`** — add field with default value to the store object.
2. **`src/components/ControlPanel.jsx`** — add a row to the `CONTROLS` array.
3. **`src/hooks/useThreeScene.js`** — add to `mainUniforms` (initial value), and update inside the `tick()` function each frame.
4. **`src/shaders/psychedelic.frag`** — declare the uniform at the top, use it in the body where it makes sense.
5. **`src/utils/shareUtils.js`** — add the key to `KEYS` and `DEFAULTS` so it survives URL save/share.

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

Add to `mainUniforms` (initial value):
```js
u<PascalName>: { value: <default> },
```

Inside `tick()`, after the existing uniform updates:
```js
mainUniforms.u<PascalName>.value = <name>
```

Make sure to also destructure `<name>` from `useStore.getState()` at the top of `tick()`.

### 4. Shader

In `src/shaders/psychedelic.frag`, add the uniform declaration near the top:
```glsl
uniform float u<PascalName>;
```

Then use it somewhere in the `main()` function where it makes sense for the parameter's purpose. If the user didn't specify what the parameter should do visually, ASK before guessing — wiring a uniform that does nothing is worse than no uniform.

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

If the value is an integer (like `mode`), also update the `deserialize` parseInt branch.

## Verify

After all 5 edits, run:
```bash
npm run build
```

If the build succeeds, the wiring is good — the slider will appear, drive the uniform, and serialize to the URL. If the user wants to test live, they can run `npm run dev` and check the slider visibly affects the shader.

## Reference

Existing controls (`speed`, `intensity`, `colorShift`, `chaos`) are full examples — read them across all 5 files if anything is unclear before adding a new one.
