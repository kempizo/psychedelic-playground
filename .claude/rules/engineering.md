---
name: Engineering Principles
description: Cross-cutting guidelines for trade-offs, interactions, and decisions in this codebase. Not path-scoped — applies everywhere.
---

# Engineering Principles

## Clarity over cleverness
Prefer simple, readable implementations. Refactor only after something works. Do not introduce new libraries unless there is no reasonable alternative in the existing stack (React, Three.js, Zustand, Tailwind, Web Audio API).

## Visual priority when trade-offs arise
When you must choose, prioritize in this order:
1. **Smooth motion** — jitter and stutter kill the experience immediately
2. **Performance** — if fps drops below 60, reduce visual complexity right away (fewer FBM octaves, lower particle count)
3. **Cohesion** — one well-executed visual system beats two mediocre ones
4. **Detail / variety** — fine noise and extra modes come last

## Interaction design
- Controls should feel like _influencing a system_, not toggling UI — the scene should respond as if it has inertia
- Changes must be **gradual and animated**: lerp uniform values toward the slider target over several frames; never snap directly to the new value
- Every exposed control must have a clearly visible effect — a slider that's hard to notice is worse than no slider
- UI stays minimal and non-intrusive; do not add UI elements without a direct visual reason

## Anti-patterns for this project
- **Do not add a second visual system** alongside the existing shader pipeline — one coherent system is the design
- **Do not introduce heavy postprocessing** (bloom libraries, post-processing composers) before the core pipeline is stable; the trail effect in `trail.frag` is the intentional post-process
- **Do not add a backend, auth, or database** — URL params are the share mechanism for this project
- **Do not add UI controls** that don't drive a shader uniform or a mode switch
