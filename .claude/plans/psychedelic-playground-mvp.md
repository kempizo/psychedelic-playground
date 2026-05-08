# PROJECT_PLAN.md — Psychedelic Playground (MVP v1)

---

## 1. Product Overview

**What it does:** A browser-based audio-reactive visual experience. Users feed in audio (microphone or file upload), and a real-time generative shader environment responds — colors pulse, geometry warps, patterns evolve based on sound. Users tweak behavior via a minimal control panel, then save and share their visual state via URL.

**Why it's compelling:** It sits at the intersection of music visualization, creative tools, and interactive art. It requires no downloads, no accounts, and delivers an immediately impressive result within seconds of loading. Shareable states mean every user is also a potential growth vector.

**Target user:** Music lovers, creative coders, generative artists, festival/rave culture enthusiasts, and anyone who wants to share something beautiful they made with a song.

---

## 2. Core MVP Features

### MUST HAVE (v1)

- Audio input: file upload (MP3/WAV) and microphone via `getUserMedia`
- Audio analysis: real-time FFT using Web Audio API `AnalyserNode`, split into 4 frequency bands
- ONE visual system: full-screen GLSL fragment shader on a Three.js quad, driven by audio uniforms
- Trailing echo: framebuffer ping-pong blend (previous frame × 0.85 + current) for dream-like persistence
- Minimal particle system: small glowing dots on treble hits, drift + fade (GPU-based, low count)
- Control panel: 5 controls — Speed, Intensity, Color Shift, Chaos, Mode toggle (2 shader modes)
- Save/share: serialize control state + mode to URL query params (no backend required for MVP)

### NICE TO HAVE (later)

- Multiple distinct visual scenes / shader presets
- Beat detection (not just amplitude)
- MIDI controller support
- Screenshot / video export
- User accounts and cloud save
- Collaborative rooms (same visual, multiple users)
- Mobile touch controls

---

## 3. User Experience Flow

```
1. LANDING
   └─ Full-screen animated shader (idle demo, no audio)
   └─ Two CTAs: "Use Microphone" | "Upload Audio"

2. AUDIO INPUT
   ├─ Mic: browser permission prompt → live analysis begins immediately
   └─ Upload: file picker → decoded via AudioContext → playback begins

3. EXPERIENCE (main loop)
   └─ Shader reacts to audio in real-time
   └─ Control panel slides in from bottom/side
   └─ User tweaks Speed, Intensity, Color Shift, Warp, Mode

4. SAVE / SHARE
   └─ "Share" button serializes state to URL params
   └─ URL copied to clipboard
   └─ Recipient opens URL → same visual state loads instantly, idle mode

5. RETURN VISIT / SHARED LINK
   └─ URL params hydrate control state on load
   └─ User can re-attach audio to the saved visual
```

---

## 4. Tech Stack

### Frontend

| Choice | Justification |
|---|---|
| **React + Vite** | No SSR needed, Vite is fast for iteration, HMR works well with canvas |
| **Three.js** | Best WebGL abstraction for shader work; huge community, good docs |
| **Custom GLSL shaders** | Required for psychedelic quality — no library gives this level of control |
| **Zustand** | Minimal boilerplate, fast for audio-driven state that updates 60x/sec |
| **Tailwind CSS** | Fast UI styling, no fight with Three.js canvas |

### Audio

| Choice | Justification |
|---|---|
| **Web Audio API** | Native browser, zero latency, no deps; `AnalyserNode` gives FFT data directly |

### Backend

**MVP: No backend.** State is serialized to URL. This removes all infra complexity for v1.

If save-to-server is needed later: a single serverless function (Vercel/Netlify) + Supabase table, 2 endpoints, no auth.

---

## 5. System Architecture

```
┌──────────────────────────────────────────────────────┐
│                     BROWSER                          │
│                                                      │
│  ┌─────────────┐     ┌──────────────────────────┐   │
│  │ AudioSource │────▶│  Web Audio API           │   │
│  │ (mic/file)  │     │  AudioContext             │   │
│  └─────────────┘     │  AnalyserNode (FFT 2048) │   │
│                      └────────────┬─────────────┘   │
│                                   │ Uint8Array[2048] │
│                                   ▼                  │
│                      ┌────────────────────────┐      │
│                      │  useAudioAnalyser hook │      │
│                      │  band extraction       │      │
│                      │  (sub, bass, mid, hi)  │      │
│                      └────────────┬───────────┘      │
│                                   │ {bass, mid, hi,  │
│                                   │  sub} 0.0–1.0    │
│                                   ▼                  │
│  ┌──────────────┐    ┌────────────────────────┐      │
│  │ControlPanel  │───▶│  Zustand Store         │      │
│  │(5 sliders)   │    │  {speed, intensity,    │      │
│  └──────────────┘    │   colorShift, warp,    │      │
│                      │   mode, audioData}     │      │
│                      └────────────┬───────────┘      │
│                                   │ uniforms          │
│                                   ▼                  │
│                      ┌────────────────────────┐      │
│                      │  Three.js Scene        │      │
│                      │  PlaneGeometry (quad)  │      │
│                      │  ShaderMaterial        │      │
│                      │  ↳ psychedelic.frag    │      │
│                      │  requestAnimationFrame │      │
│                      └────────────────────────┘      │
│                                   │                  │
│                                   ▼                  │
│                      ┌────────────────────────┐      │
│                      │   WebGL Canvas         │      │
│                      │   (full viewport)      │      │
│                      └────────────────────────┘      │
└──────────────────────────────────────────────────────┘

URL Params ──▶ hydrate Zustand on load (share/save)
Share Button ──▶ serialize Zustand to URL ──▶ clipboard
```

---

## 6. Folder Structure

```
psychedelic-playground/
├── index.html
├── vite.config.js
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── .env.example
│
└── src/
    ├── main.jsx                    # Vite entry, React root
    ├── App.jsx                     # Route: landing vs experience
    │
    ├── components/
    │   ├── LandingScreen.jsx       # Initial CTA, idle shader preview
    │   ├── AudioInput.jsx          # Mic / upload selector
    │   ├── VisualCanvas.jsx        # Three.js mount point, render loop owner
    │   ├── ControlPanel.jsx        # 5 sliders + mode toggle
    │   └── ShareButton.jsx         # Serialize → URL → clipboard
    │
    ├── hooks/
    │   ├── useAudioAnalyser.js     # AnalyserNode setup, band extraction, rAF loop
    │   ├── useThreeScene.js        # Scene, camera, renderer init + resize handler
    │   └── useURLState.js          # Hydrate/sync Zustand ↔ URL params
    │
    ├── audio/
    │   ├── analyser.js             # Create AudioContext, connect AnalyserNode
    │   ├── bands.js                # FFT array → {sub, bass, mid, hi} 0–1
    │   └── mic.js                  # getUserMedia wrapper
    │
    ├── three/
    │   ├── scene.js                # Scene + camera factory
    │   ├── renderer.js             # WebGLRenderer factory + resize
    │   ├── quad.js                 # Full-screen PlaneGeometry + ShaderMaterial
    │   └── renderTargets.js        # Ping-pong WebGLRenderTarget pair for trail effect
    │
    ├── shaders/
    │   ├── psychedelic.vert        # Passthrough vertex shader
    │   └── psychedelic.frag        # Main GLSL fragment shader
    │
    ├── store/
    │   └── useStore.js             # Zustand store: audio data + UI controls
    │
    └── utils/
        ├── colorUtils.js           # HSL helpers, palette math
        ├── shareUtils.js           # Serialize/deserialize URL params
        └── mathUtils.js            # smoothstep, lerp, clamp wrappers
```

---

## 7. Component Breakdown

| Component | Responsibility |
|---|---|
| `App.jsx` | Manages landing vs experience state; reads URL params on mount |
| `LandingScreen.jsx` | Full-screen idle visual + two CTAs; no audio attached |
| `AudioInput.jsx` | Mic permission flow or file `<input>`; hands AudioNode to parent |
| `VisualCanvas.jsx` | Owns the Three.js render loop; manages ping-pong render targets for trail; reads Zustand and updates shader uniforms each frame |
| `ControlPanel.jsx` | 5 range inputs + mode toggle; writes to Zustand; overlaid on canvas |
| `ShareButton.jsx` | Calls `shareUtils.serialize(store)` → pushes to URL → `navigator.clipboard.writeText` |

---

## 8. Audio-Reactive Visual System

### Capture
```
getUserMedia({ audio: true }) ──▶ MediaStream ──▶ AudioContext.createMediaStreamSource()
FileReader → AudioContext.decodeAudioData() ──▶ AudioBufferSourceNode
Both connect to: ──▶ AnalyserNode (fftSize: 2048)
```

### Extraction (`bands.js`)
```js
// FFT bins: 0–2048, each bin = sampleRate / fftSize Hz
// At 44100Hz / 2048 = ~21.5 Hz per bin

const SUB  = [0, 4]     // 0–86 Hz   (sub-bass)
const BASS = [4, 20]    // 86–430 Hz (kick, bass guitar)
const MID  = [20, 100]  // 430–2150 Hz (vocals, synths)
const HI   = [100, 400] // 2150–8600 Hz (hi-hats, air)

function extractBands(dataArray) {
  // Average magnitude in each range, normalize 0–1
  return { sub, bass, mid, hi }
}
```

### Smoothing
Apply exponential moving average per band each frame to prevent jitter:
```js
smoothed = smoothed * 0.8 + raw * 0.2
```

### Uniform Mapping

| Audio Band | Visual Effect | GLSL Uniform |
|---|---|---|
| `bass` (20–150 Hz) | Scale warp amplitude, "gravity pull" inward on kick | `uBass` |
| `sub` (0–86 Hz) | Slow camera drift magnitude | `uSub` |
| `mid` (150–2000 Hz) | Shape distortion intensity, domain warp strength | `uMid` |
| `hi` (2000+ Hz) | Fine noise detail, particle emission rate, shimmer | `uHi` |
| All composite | Master intensity driver | `uEnergy` |

User slider `Intensity` multiplies all audio values before passing to uniforms (boosts quiet sources). `Chaos` slider multiplies the domain warp offset independently of audio.

---

## 9. Shader / Visual Strategy

### Aesthetic Direction — "Organic Consciousness Engine"

The visual should feel like **a living entity reacting to sound**, not a decorative visualizer. Specific constraints:
- Background: near-black (`#050505`) — colors emerge from darkness
- Palette: electric teal + acid green primary, deep violet secondary/subtle
- Motion: slow, breathing, continuous — never static, never strobing
- Shape language: smooth blob-like morphing forms, no hard geometric edges
- Avoid: full rainbow gradients, fast flashing, overly chaotic motion

### Render Pipeline — Two Passes

Because of the trailing echo requirement, the render loop has two passes per frame:

```
Pass 1: Render shader to WebGLRenderTarget A
Pass 2: Blend A with previous frame (RenderTarget B × 0.85 + A × 0.15) → draw to screen
Swap A/B for next frame (ping-pong)
```

`renderTargets.js` owns the two `WebGLRenderTarget` instances. `VisualCanvas` swaps them each frame. This produces the "dream-like persistence / trailing echo" at zero extra shader complexity.

### Approach: Fragment Shader on Full-Screen Quad

Single `PlaneGeometry(2, 2)` with `ShaderMaterial`. No perspective needed. Vertex shader is a passthrough. All computation in the fragment shader.

**Why not particles or geometry?** Simpler, more controllable, better performance, easier to iterate.

### Technique: Domain-Warped Fractal Brownian Motion (FBM)

```glsl
// psychedelic.frag (pseudocode structure)

uniform float uTime;
uniform float uBass;    // scale warp amplitude
uniform float uMid;     // distortion / warp strength
uniform float uHi;      // fine noise + particle rate
uniform float uSub;     // drift magnitude
uniform float uSpeed;
uniform float uIntensity;
uniform float uColorShift;
uniform float uChaos;   // independent warp multiplier (was uWarp)
uniform int   uMode;
uniform vec2  uResolution;
uniform sampler2D uPrevFrame;  // ping-pong trail input

// 1. Normalize coords
vec2 p = (gl_FragCoord.xy / uResolution) * 2.0 - 1.0;
p.x *= uResolution.x / uResolution.y;  // aspect correct

// 2. Slow camera drift (sub-bass driven)
p += vec2(sin(uTime * 0.1), cos(uTime * 0.07)) * uSub * 0.1;

// 3. Domain warp — two layers
vec2 q = vec2(fbm(p + uTime * uSpeed), fbm(p + 1.7));
vec2 r = vec2(fbm(p + uChaos * q + uBass * 0.5), fbm(p + uChaos * q));

// 4. Base value
float f = fbm(p + uMid * r);

// 5. Color — organic palette (teal/green/violet from near-black)
vec3 color = palette(f + uColorShift, uBass, uMid);
color *= uIntensity;

// 6. Output — trail blending done in Pass 2 (separate quad)
gl_FragColor = vec4(color, 1.0);
```

**Color palette (replaces generic IQ defaults):**
```glsl
vec3 palette(float t, float bass, float mid) {
  // Teal → acid green → deep violet, emerging from near-black
  vec3 a = vec3(0.05, 0.1, 0.1);          // dark base (near-black)
  vec3 b = vec3(0.4, 0.5, 0.3);           // range
  vec3 c = vec3(1.0, 0.8, 1.2);           // frequency
  vec3 d = vec3(0.45, 0.25, 0.65);        // teal/green/violet offsets
  return a + b * cos(6.28318 * (c * t + d + mid * 0.15));
}
```

**Mode toggle (uMode):** `0` = Cartesian domain warp (flowing liquid), `1` = polar coordinate warp (radial mandala-like). Same FBM math, just `p` is converted to polar before warping.

### Particle System (v1 — minimal)

- Implemented as a second `ShaderMaterial` quad layered on top (additive blending)
- Particle positions encoded in a small data texture (64×1 RGBA), updated on CPU
- Spawn rate driven by `uHi`; each particle has position, velocity, age
- Render: tiny bright dots (`gl_PointSize = 2.0–4.0`), fade out over ~2 seconds
- Max particle count: 128 (stays GPU-cheap)

### References to Start From
- Inigo Quilez: https://iquilezles.org/articles/warp/ (domain warping)
- Shadertoy "Warping - procedural 2" (IQ) — port as starting point
- IQ cosine palette: https://iquilezles.org/articles/palettes/
- Search terms for additional reference: "fbm fluid shader", "domain warped noise", "organic audio reactive glsl"

---

## 10. API Design

**MVP: No API. State lives in URL.**

```
https://app.com/?speed=0.5&intensity=0.8&colorShift=0.3&warp=0.6&mode=1
```

`shareUtils.js` serializes the 5 controls to query params and reads them on load.

**Post-MVP API (when needed):**

```
POST /api/states
Body: { speed, intensity, colorShift, warp, mode, label? }
Returns: { id: "abc123" }

GET /api/states/:id
Returns: { speed, intensity, colorShift, warp, mode, label, createdAt }
```

URL becomes: `https://app.com/s/abc123`

---

## 11. State Management

**Zustand store** (`store/useStore.js`) owns all shared state:

```js
{
  // Audio data (written 60x/sec by useAudioAnalyser)
  audioData: { sub: 0, bass: 0, mid: 0, hi: 0 },

  // UI controls (written by ControlPanel, read by VisualCanvas)
  speed: 0.5,
  intensity: 0.7,
  colorShift: 0.0,
  chaos: 0.5,      // formerly "warp" — renamed to match visual spec
  mode: 0,         // 0 | 1

  // Audio source state
  audioSource: null,   // 'mic' | 'file' | null
  isPlaying: false,

  // Actions
  setAudioData: (data) => ...,
  setControl: (key, value) => ...,
  setAudioSource: (source) => ...,
}
```

**Sync rules:**
- `VisualCanvas` subscribes to the full store and passes uniforms each rAF
- `useAudioAnalyser` writes `audioData` every rAF — no React re-renders, direct Zustand calls
- `useURLState` reads params on mount, writes to store; subscribes to control changes to update URL

---

## 12. Development Phases

### Phase 1 — Project Setup (Day 1)
```bash
npm create vite@latest psychedelic-playground -- --template react
cd psychedelic-playground
npm install three zustand tailwindcss
npx tailwindcss init -p
```
- Wire up Vite + React + Tailwind
- Create folder structure (all dirs, placeholder files)
- Confirm blank canvas renders

**Deliverable:** App loads, shows blank page with `<canvas>` element.

---

### Phase 2 — Audio Integration (Day 1–2)
Files: `src/audio/`, `src/hooks/useAudioAnalyser.js`

- Implement `analyser.js`: `AudioContext`, `AnalyserNode`, connect any `AudioNode` source
- Implement `mic.js`: `getUserMedia` → `createMediaStreamSource`
- Implement `bands.js`: FFT → `{sub, bass, mid, hi}`
- Implement `useAudioAnalyser` hook: rAF loop, smooth values, write to Zustand
- Build `AudioInput.jsx`: mic button + file input, connect to audio system
- Console.log band values to verify they react to sound

**Deliverable:** Open browser console, make sound into mic, see `{sub, bass, mid, hi}` change in real-time.

---

### Phase 3 — Visual System (Day 2–3)
Files: `src/shaders/`, `src/three/`, `src/hooks/useThreeScene.js`, `src/components/VisualCanvas.jsx`

Build in this exact order (from visual spec):

1. Render static organic shader (no audio) — confirm teal/green/violet palette, near-black bg
2. Add `uTime` uniform, implement slow breathing expansion (sinusoidal scale)
3. Implement ping-pong `WebGLRenderTarget` pair in `renderTargets.js`; add trail blend pass (prev frame × 0.85)
4. Connect audio: map `uBass` → scale warp amplitude
5. Connect audio: map `uMid` → domain distortion intensity
6. Connect audio: map `uHi` → fine noise detail
7. Add particle layer: spawn on treble hits, fade out over 2s, max 128 particles
8. Wire all UI controls (`uSpeed`, `uIntensity`, `uColorShift`, `uChaos`, `uMode`)

**Deliverable:** Full-screen shader reacts to audio. Bass pulses inward, mids warp shapes, treble adds shimmer+particles, trail creates persistence effect.

---

### Phase 4 — Interaction Layer (Day 3–4)
Files: `src/components/ControlPanel.jsx`, `src/store/useStore.js` (finalize)

- Build `ControlPanel`: 5 labeled range inputs, mode toggle
- Wire sliders → Zustand → shader uniforms
- Add `uSpeed`, `uIntensity`, `uColorShift`, `uWarp`, `uMode` uniforms to shader
- Implement mode switch: `uMode == 0` → standard warp, `uMode == 1` → polar coordinate warp
- Style with Tailwind: semi-transparent panel overlaid on canvas, slide in from bottom

**Deliverable:** All 5 controls visibly affect the shader in real-time.

---

### Phase 5 — Save / Share (Day 4)
Files: `src/utils/shareUtils.js`, `src/hooks/useURLState.js`, `src/components/ShareButton.jsx`

- Write `shareUtils.serialize(state)` → URL query string
- Write `shareUtils.deserialize(search)` → state object (with validation/defaults)
- Implement `useURLState` hook: hydrate on mount, debounce-update URL on control change
- Build `ShareButton`: calls serialize, `navigator.clipboard.writeText(url)`, shows "Copied!" feedback
- Test: set controls → copy URL → open in new tab → same state loads

**Deliverable:** Share URL works end-to-end. Recipient sees the same visual configuration.

---

### Phase 6 — Polish + Landing (Day 5)
Files: `src/components/LandingScreen.jsx`, `src/App.jsx`

- Build landing screen: full-screen idle shader animation (no audio, time-driven)
- Two CTAs: "Use Microphone" / "Upload Audio" — both transition to experience view
- Add smooth transition (opacity fade) from landing to experience
- Handle edge cases: mic denied, invalid file type, browser without Web Audio API
- Cross-browser test: Chrome, Firefox, Safari

**Deliverable:** Shippable v1. Full flow from landing to experience to share.

---

## 13. Risks & Complexity Warnings

| Risk | Severity | Mitigation |
|---|---|---|
| **GLSL shader complexity** | High | Start from IQ's working Shadertoy example, port incrementally, don't write from scratch |
| **Ping-pong render targets** | High | Two `WebGLRenderTarget` instances; must resize both on viewport change; easy to get swap order wrong — write a helper and test first |
| **Particle system on GPU** | Medium | Keep count ≤128, use `gl.POINTS`, data texture update — don't use Three.js `Points` abstraction (too slow for per-frame updates) |
| **Color palette drift** | Low-Med | Palette is teal/green/violet specific — if IQ defaults bleed through, check the `a/b/c/d` vectors in `palette()` |
| **Audio sync latency** | Medium | Use `AnalyserNode` directly in rAF — don't go through React state |
| **Mobile performance** | Medium | Test on real device early; reduce `fftSize` to 1024 on mobile; disable particles on low-end |
| **Mic permission UX** | Low-Med | Handle denied state gracefully with clear error message and fallback to upload |
| **Safari Web Audio quirks** | Medium | AudioContext must be resumed after user gesture; wrap in click handler |
| **Zustand audio writes at 60fps** | Low | Use `store.getState().setAudioData()` directly — bypasses React re-render cycle |
| **Shader uniform type mismatch** | Low | GLSL is strict; `int` vs `float` will silently fail — always cast explicitly |

**Common mistakes to avoid:**
- Don't put `audioData` in React state — it will cause 60 re-renders/sec
- Don't create a new `AudioContext` on every render — create once, ref it
- Don't use `setTimeout` for the audio analysis loop — use rAF tied to the render loop
- Don't add a backend until URL params are genuinely insufficient

---

## 14. Future Expansion Ideas

- Beat detection (onset detection algorithm on sub-bass delta)
- Multiple shader presets with animated transitions between them
- MIDI controller support via Web MIDI API
- Canvas screenshot download + animated GIF export
- Collaborative rooms: WebSocket server syncs control state across users
- Mobile touch gestures: pinch = warp, swipe = color shift
- AI prompt-to-shader: describe a visual, generate GLSL variant
- Embedding: `<iframe>` embed with URL params for external sites

---

*End of PROJECT_PLAN.md*
