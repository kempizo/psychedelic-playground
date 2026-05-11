import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createRenderer, resizeRenderer } from '../three/renderer'
import { createScene } from '../three/scene'
import { createPingPongTargets } from '../three/renderTargets'
import { createQuad } from '../three/quad'
import vertSrc from '../shaders/psychedelic.vert?raw'
import fragSrc from '../shaders/psychedelic.frag?raw'
import trailFrag from '../shaders/trail.frag?raw'
import passVert from '../shaders/psychedelic.vert?raw'
import particleVert from '../shaders/particle.vert?raw'
import particleFrag from '../shaders/particle.frag?raw'
import useStore from '../store/useStore'
import { BehavioralController } from '../behaviors/BehavioralController'
import {
  pushMousePos,
  pushClickTime,
  detectCircle,
  detectFigure8,
  detectRapidClick,
  resetGestureState,
} from '../utils/gestures'

const MAX_PARTICLES = 128

export function useThreeScene(canvasRef) {
  const cleanupRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const renderer = createRenderer(canvasRef.current)
    const { scene, camera } = createScene()
    // Three independent render targets — no shared textures.
    // rtA: fresh main shader output each frame.
    // rtB + rtC: ping-pong for trail accumulation so Pass 2 never reads and
    // writes the same target (WebGL feedback loop).
    const [rtA, rtB] = createPingPongTargets()
    const rtC = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    })

    // ── Main shader material ──────────────────────────────────────────────────
    const mainUniforms = {
      uTime:       { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uBass:       { value: 0 },
      uMid:        { value: 0 },
      uHi:         { value: 0 },
      uSub:        { value: 0 },
      uSpeed:      { value: 0.4 },
      uIntensity:  { value: 0.7 },
      uColorShift: { value: 0 },
      uChaos:      { value: 0.5 },
      uMode:       { value: 0 },
      uMouse:      { value: new THREE.Vector2(0, 0) },
      uMouseVel:   { value: 0 },
      uForces: { value: [
        new THREE.Vector4(0,0,0,0), new THREE.Vector4(0,0,0,0),
        new THREE.Vector4(0,0,0,0), new THREE.Vector4(0,0,0,0),
        new THREE.Vector4(0,0,0,0), new THREE.Vector4(0,0,0,0),
        new THREE.Vector4(0,0,0,0), new THREE.Vector4(0,0,0,0),
      ]},
      uColorSpike:      { value: 0 },
      uDistortionSpike: { value: 0 },
      uMouseDir:        { value: new THREE.Vector2(0, 0) },
      uEnergy:          { value: 0 },
      uPaletteFamily:   { value: 0 },
      uPaletteFamilyBlend: { value: 0 },
      uPaletteShift:    { value: 0 },
      uForceMeta: { value: [
        new THREE.Vector4(0,0,0,0), new THREE.Vector4(0,0,0,0),
        new THREE.Vector4(0,0,0,0), new THREE.Vector4(0,0,0,0),
        new THREE.Vector4(0,0,0,0), new THREE.Vector4(0,0,0,0),
        new THREE.Vector4(0,0,0,0), new THREE.Vector4(0,0,0,0),
      ]},
      // Slow sub-bass accumulator: integrates sub over time, decays at ~0.997/frame.
      // Gives the camera a lazy inertial drift that persists through bass-heavy passages.
      uCamDrift: { value: new THREE.Vector2(0, 0) },
      // Cross-band interaction products — smoothed each frame
      uBassMid: { value: 0 },
      uMidHi:   { value: 0 },
      uBassHi:  { value: 0 },
      uCoreEnergy:    { value: 0 },
      uSurfaceEnergy: { value: 0 },
      uParticleEnergy:{ value: 0 },
      uBeatPhase:     { value: 0 },
      uPalettePhase:  { value: 0 },
      uModeBlend:     { value: new THREE.Vector4(0, 0, 0, 0) },
      uCameraDistance:{ value: 2.8 },
      uSpectralCentroid: { value: 0 },
      uSpectralFlux: { value: 0 },
      uProcIntensity: { value: 0.45 },
    }
    const mainMat = new THREE.RawShaderMaterial({
      vertexShader: vertSrc,
      fragmentShader: fragSrc,
      uniforms: mainUniforms,
    })
    const mainQuad = createQuad(mainMat)
    scene.add(mainQuad)

    // ── Trail blend material ──────────────────────────────────────────────────
    const trailScene = new THREE.Scene()
    const trailUniforms = {
      uCurrent: { value: null },
      uPrev:    { value: null },
      uDecay:   { value: 0.82 },
      uEnergy:  { value: 0 },
      uBeatPhase: { value: 0 },
    }
    const trailMat = new THREE.RawShaderMaterial({
      vertexShader: passVert,
      fragmentShader: trailFrag,
      uniforms: trailUniforms,
    })
    const trailQuad = createQuad(trailMat)
    trailScene.add(trailQuad)

    // ── Particle system ───────────────────────────────────────────────────────
    const particleScene = new THREE.Scene()
    const positions  = new Float32Array(MAX_PARTICLES * 3)
    const ages       = new Float32Array(MAX_PARTICLES)
    const lives      = new Float32Array(MAX_PARTICLES)
    const ptypes     = new Float32Array(MAX_PARTICLES)  // 0=dust 1=spark 2=droplet
    const pdepths    = new Float32Array(MAX_PARTICLES)
    const velocities = Array.from({ length: MAX_PARTICLES }, () => ({ x: 0, y: 0 }))

    // Init all particles as dead
    lives.fill(1)
    ages.fill(999)
    pdepths.fill(1)

    const pGeo = new THREE.BufferGeometry()
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    pGeo.setAttribute('aAge',     new THREE.BufferAttribute(ages, 1))
    pGeo.setAttribute('aLife',    new THREE.BufferAttribute(lives, 1))
    pGeo.setAttribute('aType',    new THREE.BufferAttribute(ptypes, 1))
    pGeo.setAttribute('aDepth',   new THREE.BufferAttribute(pdepths, 1))

    const pMat = new THREE.ShaderMaterial({
      vertexShader: particleVert,
      fragmentShader: particleFrag,
      uniforms: {
        uPixelRatio:    { value: renderer.getPixelRatio() },
        uPaletteFamily: { value: 0 },
        uPaletteFamilyBlend: { value: 0 },
        uPaletteShift:  { value: 0 },
        uEnergy:        { value: 0 },
        uParticleEnergy:{ value: 0 },
        uBeatPhase:     { value: 0 },
        uParticleDensity: { value: 1 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const pMesh = new THREE.Points(pGeo, pMat)
    pMesh.frustumCulled = false
    particleScene.add(pMesh)

    let particleCamera = camera

    // ── Final composite scene ─────────────────────────────────────────────────
    const finalScene = new THREE.Scene()
    const finalUniforms = { uCurrent: { value: null } }
    const finalMat = new THREE.RawShaderMaterial({
      vertexShader: passVert,
      fragmentShader: `
        precision highp float;
        uniform sampler2D uCurrent;
        varying vec2 vUv;
        void main() { gl_FragColor = texture2D(uCurrent, vUv); }
      `,
      uniforms: finalUniforms,
    })
    finalScene.add(createQuad(finalMat))

    // ── Resize handler ────────────────────────────────────────────────────────
    const onResize = () => {
      resizeRenderer(renderer, [rtA, rtB, rtC])
      mainUniforms.uResolution.value.set(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    // ── Mouse tracking ────────────────────────────────────────────────────────
    const rawMouse      = new THREE.Vector2(0, 0)
    const prevRawMouse  = new THREE.Vector2(0, 0)
    const smoothedMouse = new THREE.Vector2(0, 0)
    const centeredMouse = new THREE.Vector2(0, 0)
    const mouseDirSmooth = new THREE.Vector2(0, 0)
    let mouseVel = 0
    let cursorHideTimer = null

    const resetCursorTimer = () => {
      clearTimeout(cursorHideTimer)
      if (canvasRef.current) canvasRef.current.style.cursor = ''
      cursorHideTimer = setTimeout(() => {
        if (!isHolding && canvasRef.current) canvasRef.current.style.cursor = 'none'
      }, 3000)
    }

    const onMouseMove = (e) => {
      rawMouse.x =  (e.clientX / window.innerWidth)  * 2 - 1
      rawMouse.y = -((e.clientY / window.innerHeight) * 2 - 1)
      if (isHolding) pushMousePos(rawMouse.x, rawMouse.y)
      resetCursorTimer()
    }
    window.addEventListener('mousemove', onMouseMove)

    // ── Render loop ───────────────────────────────────────────────────────────
    let rafId
    // rtA = fresh main shader output each frame
    // trailRead / trailWrite ping-pong between rtB and rtC so Pass 2 never
    // reads and writes the same target (WebGL feedback loop).
    let trailRead  = rtB
    let trailWrite = rtC
    let lastHi = 0
    let lastBass = 0
    let lastBassSpawn = -999
    let blobBurstPending = 0
    let isHolding = false
    let holdStartTime = 0
    let lastHoldSpawn = -999
    const timer      = new THREE.Timer()
    const controller = new BehavioralController()

    // ── Force manager (render-loop-local, not in Zustand) ─────────────────────
    // Each force: origin (x,y), strength (signed: +push/-pull), age 0→1, radius, vel
    // Tau ≈ 0.6s; strength decays exponentially; radius grows as force spreads.
    const MAX_FORCES = 8
    const forces = Array.from({ length: MAX_FORCES }, () => ({
      x: 0, y: 0,
      strength: 0,   // signed: positive = push, negative = pull
      age: 1,        // starts at 1 (dead)
      tau: 0.6,
      radius: 0.35,
      velX: 0, velY: 0,
    }))

    const spawnForce = (x, y, strength, sign = 1, radius = 0.35, tau = 0.6, vx = 0, vy = 0) => {
      let slot = -1
      // Prefer dead slots
      for (let i = 0; i < MAX_FORCES; i++) {
        if (forces[i].age >= 1.0) { slot = i; break }
      }
      // Otherwise evict oldest
      if (slot === -1) {
        let maxAge = -1
        for (let i = 0; i < MAX_FORCES; i++) {
          if (forces[i].age > maxAge) { maxAge = forces[i].age; slot = i }
        }
      }
      const f = forces[slot]
      f.x = x; f.y = y
      f.strength = strength * sign
      f.age = 0
      f.tau = tau
      f.radius = radius
      f.velX = vx; f.velY = vy
    }

    // Legacy alias so gesture/behavioral call sites keep working during transition
    const spawnPulse = (x, y, energy) => {
      spawnForce(x, y, energy, 1, 0.35, 0.6, mouseDirSmooth.x * 0.05, mouseDirSmooth.y * 0.05)
    }

    // type: 0=dust, 1=spark, 2=droplet
    const spawnParticle = (px, py, vx, vy, life, type = 1, depth = null) => {
      for (let i = 0; i < MAX_PARTICLES; i++) {
        if (ages[i] < lives[i]) continue
        positions[i * 3]     = px
        positions[i * 3 + 1] = py
        positions[i * 3 + 2] = 0
        ages[i]   = 0
        lives[i]  = life
        ptypes[i] = type
        pdepths[i]= depth !== null ? depth : 0.4 + Math.random() * 0.6
        velocities[i].x = vx
        velocities[i].y = vy
        break
      }
    }

    const onMouseDown = (e) => {
      const x = (e.clientX / window.innerWidth)  * 2 - 1
      const y = -((e.clientY / window.innerHeight) * 2 - 1)
      pushClickTime(performance.now())
      // Shift+click = pull (inward warp), normal click = push (outward)
      const sign = e.shiftKey ? -1 : 1
      spawnForce(x, y, 0.9, sign, 0.35, 0.6, mouseDirSmooth.x * 0.05, mouseDirSmooth.y * 0.05)
      controller.injectEnergy(0.05)
      isHolding = true
      rawMouse.x = x
      rawMouse.y = y
      smoothedMouse.copy(rawMouse)
      pushMousePos(rawMouse.x, rawMouse.y)
      holdStartTime = timer.getElapsed()
      lastHoldSpawn = holdStartTime
      canvasRef.current.style.cursor = 'none'
    }
    const onMouseUp = () => {
      isHolding = false
      canvasRef.current.style.cursor = ''
    }
    canvasRef.current.addEventListener('mousedown', onMouseDown)
    canvasRef.current.addEventListener('mouseup', onMouseUp)

    const onTouchMove = (e) => {
      e.preventDefault()
      const t = e.touches[0]
      const rect = canvasRef.current.getBoundingClientRect()
      rawMouse.x = ((t.clientX - rect.left) / rect.width)  * 2 - 1
      rawMouse.y = -((t.clientY - rect.top)  / rect.height) * 2 + 1
      pushMousePos(rawMouse.x, rawMouse.y)
      resetCursorTimer()
    }
    const onTouchStart = (e) => {
      const t = e.touches[0]
      const rect = canvasRef.current.getBoundingClientRect()
      rawMouse.x = ((t.clientX - rect.left) / rect.width)  * 2 - 1
      rawMouse.y = -((t.clientY - rect.top)  / rect.height) * 2 + 1
      smoothedMouse.copy(rawMouse)
      pushMousePos(rawMouse.x, rawMouse.y)
      isHolding = true
      holdStartTime = timer.getElapsed()
      lastHoldSpawn = holdStartTime
      spawnForce(rawMouse.x, rawMouse.y, 0.9, 1, 0.35, 0.6)
    }
    const onTouchEnd = () => {
      isHolding = false
    }
    canvasRef.current.addEventListener('touchmove', onTouchMove, { passive: false })
    canvasRef.current.addEventListener('touchstart', onTouchStart)
    canvasRef.current.addEventListener('touchend', onTouchEnd)

    // Smoothed control values — lerped toward behavioral targets each frame.
    const {
      speed: s0,
      intensity: i0,
      colorShift: c0,
      chaos: ch0,
      trailDecay: td0,
      cameraDistance: cd0,
      procIntensity: pi0,
      particleDensity: pd0,
    } = useStore.getState()
    const smoothed = { speed: s0, intensity: i0, colorShift: c0, chaos: ch0, breakSpike: 0 }

    let prevSpeed = s0, prevIntensity = i0, prevColorShift = c0, prevChaos = ch0
    let prevTrailDecay = td0, prevCameraDistance = cd0, prevProcIntensity = pi0, prevParticleDensity = pd0
    let frameCount = 0
    let prevBehavioralState = 'calm'
    let breakEventPulseTimer = -999
    let prevMode = useStore.getState().mode
    let particleBlendFromMode = prevMode
    let modeTransition = 1
    let modeTransitionTarget = 1
    let modeTransitionHoldUntil = -999
    let smoothPaletteFamily = prevMode >= 2 ? 1 : 0
    let smoothTrailDecay = 0.84
    const visualState = {
      coreEnergy: 0,
      surfaceEnergy: 0,
      particleEnergy: 0,
      beatPhase: 0,
      palettePhase: c0,
      cameraDistance: 2.8,
      modeBlend: new THREE.Vector4(0, 0, 0, 0),
    }
    // uCamDrift accumulator: slowly integrates sub-bass, decays at 0.997/frame
    const camDrift = new THREE.Vector2(0, 0)
    // Smoothed cross-band products (EMA, tau ~0.1s)
    let smoothBassMid = 0, smoothMidHi = 0, smoothBassHi = 0

    // Curl noise: divergence-free 2D velocity field from gradient of a scalar noise.
    // Uses finite differences on a smooth hash to approximate ∂n/∂y and -∂n/∂x.
    const hashJs = (x, y) => {
      let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
      return h - Math.floor(h)
    }
    const noiseJs = (x, y) => {
      const ix = Math.floor(x), iy = Math.floor(y)
      const fx = x - ix, fy = y - iy
      const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
      const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
      const a = hashJs(ix,     iy)
      const b = hashJs(ix + 1, iy)
      const c = hashJs(ix,     iy + 1)
      const d = hashJs(ix + 1, iy + 1)
      return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
    }
    const curlNoise = (x, y, t) => {
      const eps = 0.01
      const n1 = noiseJs(x + eps, y + t * 0.08)
      const n2 = noiseJs(x - eps, y + t * 0.08)
      const n3 = noiseJs(x + t * 0.06, y + eps)
      const n4 = noiseJs(x + t * 0.06, y - eps)
      return { x: (n3 - n4) / (2 * eps), y: -(n1 - n2) / (2 * eps) }
    }

    const smoothstep05 = (x, edge0, edge1) => {
      const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
      return t * t * (3 - 2 * t)
    }

    const spawnParticleForMode = (spawnMode, hiVal, depth) => {
      if (spawnMode === 2) {
        // Vortex: spawn tangentially around a ring, orbit outward
        const angle = Math.random() * Math.PI * 2
        const r = 0.3 + Math.random() * 0.5
        const tangX = -Math.sin(angle) * 0.005 * (1 + hiVal)
        const tangY =  Math.cos(angle) * 0.005 * (1 + hiVal)
        spawnParticle(Math.cos(angle) * r, Math.sin(angle) * r,
          tangX, tangY, 1.5 + Math.random() * 1.5, 1, depth)
      } else if (spawnMode === 3) {
        // Collapse: spawn near edges, fall toward center (droplet type)
        const angle = Math.random() * Math.PI * 2
        const r = 0.6 + Math.random() * 0.4
        const cx = Math.cos(angle) * r, cy = Math.sin(angle) * r
        const n = Math.sqrt(cx * cx + cy * cy) || 1
        spawnParticle(cx, cy, -cx / n * 0.004, -cy / n * 0.004,
          1.5 + Math.random() * 1.5, 2, depth)
      } else if (spawnMode === 4) {
        // Orbit: spawn near the three seam regions (120° intervals)
        const seam = Math.floor(Math.random() * 3) * (Math.PI * 2 / 3)
        const angle = seam + (Math.random() - 0.5) * 0.6
        const r = 0.25 + Math.random() * 0.15
        spawnParticle(Math.cos(angle) * r, Math.sin(angle) * r,
          (Math.random() - 0.5) * 0.004, (Math.random() - 0.5) * 0.004 + 0.001,
          1.5 + Math.random() * 1.5, 1, depth)
      } else {
        // Fluid / Radial: ambient dust
        spawnParticle(
          Math.random() * 2 - 1, Math.random() * 2 - 1,
          (Math.random() - 0.5) * 0.004, (Math.random() - 0.5) * 0.004 + 0.001,
          1.5 + Math.random() * 1.5, 0, depth)
      }
    }

    const tick = () => {
      rafId = requestAnimationFrame(tick)
      timer.update()
      const elapsed = timer.getElapsed()
      // Clamp dt to prevent single-frame spikes (tab refocus, hitching)
      const dt = Math.min(timer.getDelta(), 1 / 30)

      // Force tick: age → strength decay → radius spread → cull
      for (let i = 0; i < MAX_FORCES; i++) {
        const f = forces[i]
        if (f.age >= 1.0) continue
        f.age += dt / f.tau
        f.strength *= Math.exp(-dt / f.tau)
        // Forces spread as they decay — the disturbance fans out
        f.radius = Math.min(f.radius + dt * 0.12, 1.0)
        if (f.age >= 1.0 || Math.abs(f.strength) < 0.01) f.age = 1.0
      }

      const store = useStore.getState()
      const { audioData, speed, intensity, colorShift, chaos, mode, trailDecay, cameraDistance, procIntensity, particleDensity } = store
      if (mode !== prevMode) {
        particleBlendFromMode = prevMode
        modeTransitionTarget = 0
        modeTransitionHoldUntil = elapsed + 0.12
        prevMode = mode
      }
      if (modeTransitionTarget === 0 && elapsed >= modeTransitionHoldUntil) {
        modeTransitionTarget = 1
      }
      const modeTransitionTau = modeTransitionTarget === 0 ? 0.05 : 0.75
      modeTransition += (modeTransitionTarget - modeTransition) * (1 - Math.exp(-dt / modeTransitionTau))

      // Detect slider changes to reset auto-blend idle timer
      const anyChanged = Math.abs(speed      - prevSpeed)      > 0.005 ||
                         Math.abs(intensity  - prevIntensity)  > 0.005 ||
                         Math.abs(colorShift - prevColorShift) > 0.005 ||
                         Math.abs(chaos      - prevChaos)      > 0.005 ||
                         Math.abs(trailDecay - prevTrailDecay) > 0.005 ||
                         Math.abs(cameraDistance - prevCameraDistance) > 0.005 ||
                         Math.abs(procIntensity - prevProcIntensity) > 0.005 ||
                         Math.abs(particleDensity - prevParticleDensity) > 0.005
      if (anyChanged) controller.userIdleTimer = 0
      prevSpeed = speed; prevIntensity = intensity
      prevColorShift = colorShift; prevChaos = chaos
      prevTrailDecay = trailDecay; prevCameraDistance = cameraDistance
      prevProcIntensity = procIntensity; prevParticleDensity = particleDensity

      // Behavioral controller: blends user controls with state-machine targets
      const bOut = controller.tick(audioData, dt, { speed, intensity, colorShift, chaos })

      // Exponential easing: tau=0.25s gives smooth response without snapiness
      const lerpCtrl = 1 - Math.exp(-dt / 0.25)
      smoothed.speed      += (bOut.speed      - smoothed.speed)      * lerpCtrl
      smoothed.intensity  += (bOut.intensity  - smoothed.intensity)  * lerpCtrl
      smoothed.colorShift += (bOut.colorShift - smoothed.colorShift) * lerpCtrl
      smoothed.chaos      += (bOut.chaos      - smoothed.chaos)      * lerpCtrl

      // Bass auto-spawn: rising edge with 0.3s cooldown → push force at blob center
      const curBass = audioData.bass
      if (curBass > lastBass * 1.3 && curBass > 0.35 && (elapsed - lastBassSpawn) > 0.3) {
        const energy = Math.min(curBass * smoothed.intensity, 0.9)
        const jx = (Math.random() - 0.5) * 0.1 + mouseDirSmooth.x * 0.08
        const jy = (Math.random() - 0.5) * 0.1 + mouseDirSmooth.y * 0.08
        spawnForce(jx, jy, energy, 1, 0.40, 0.5)
        lastBassSpawn = elapsed
        controller.injectEnergy(0.03)
      }
      lastBass = curBass

      // Hold-and-drag: continuous small force at cursor, short tau → paints force
      if (isHolding && (elapsed - holdStartTime) > 0.15 && (elapsed - lastHoldSpawn) > 0.05) {
        const vx = rawMouse.x - prevRawMouse.x
        const vy = rawMouse.y - prevRawMouse.y
        spawnForce(rawMouse.x, rawMouse.y, 0.25, 1, 0.22, 0.12, vx * 0.3, vy * 0.3)
        lastHoldSpawn = elapsed
      }

      // Push energy snapshot to store at ~20 Hz (every 3 frames) to avoid 60fps React updates
      frameCount++
      if (frameCount % 3 === 0) {
        useStore.getState().setEnergySnapshot({
          energy: bOut.state === 'peak' ? 1.0 : controller.energy,
          state: bOut.state,
          breakIntensity: bOut.breakIntensity,
        })
      }

      // Break event: detect peak→afterglow with high breakIntensity
      const isBreak = bOut.state === 'afterglow' &&
                      prevBehavioralState === 'peak' &&
                      bOut.breakIntensity > 0.7 &&
                      (elapsed - breakEventPulseTimer) > 2.0

      if (isBreak) {
        breakEventPulseTimer = elapsed
        mainUniforms.uColorSpike.value = Math.min(1.0, mainUniforms.uColorSpike.value + 1.0)
        mainUniforms.uDistortionSpike.value = Math.min(1.2, mainUniforms.uDistortionSpike.value + 1.2)
        // 3 staggered pulses: direct, +80ms, +160ms — one buildup arc, not three events
        spawnPulse((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 0.8, 0.65, 'chain', 0)
        setTimeout(() => spawnPulse((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 0.65, 0.55, 'chain', 0), 80)
        setTimeout(() => spawnPulse((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 0.5, 0.45, 'chain', 0), 160)
      }
      prevBehavioralState = bOut.state

      // Auto-mode: virtual pulses from behavioral controller
      // forceBias < 0 biases toward pull forces (LFO-driven over 113s)
      if (bOut.virtualPulse) {
        const vp = bOut.virtualPulse
        const vpSign = (bOut.forceBias ?? 0) < -0.5 ? -1 : 1
        spawnForce(vp.x, vp.y, vp.energy, vpSign, 0.35, 0.6)
      }

      // Mouse velocity: accumulate movement, decay 0.92/frame
      const targetMouse = isHolding ? rawMouse : centeredMouse
      const mouseDelta = isHolding ? rawMouse.distanceTo(prevRawMouse) : 0
      mouseVel = Math.min(mouseVel + mouseDelta, 1.0) * 0.92
      // Smoothed direction: only update when mouse is actually moving
      if (isHolding && mouseDelta > 0.0001) {
        const dl = mouseDelta
        mouseDirSmooth.x += ((rawMouse.x - prevRawMouse.x) / dl - mouseDirSmooth.x) * 0.1
        mouseDirSmooth.y += ((rawMouse.y - prevRawMouse.y) / dl - mouseDirSmooth.y) * 0.1
        const sl = Math.sqrt(mouseDirSmooth.x * mouseDirSmooth.x + mouseDirSmooth.y * mouseDirSmooth.y) || 1
        mouseDirSmooth.x /= sl
        mouseDirSmooth.y /= sl
      }
      prevRawMouse.copy(rawMouse)
      const lerpMouse = 1 - Math.exp(-dt / (isHolding ? 0.12 : 0.35))
      smoothedMouse.x += (targetMouse.x - smoothedMouse.x) * lerpMouse
      smoothedMouse.y += (targetMouse.y - smoothedMouse.y) * lerpMouse
      if (!isHolding) {
        mouseDirSmooth.multiplyScalar(Math.max(0, 1 - dt * 4))
      }
      const aspect = window.innerWidth / window.innerHeight

      // Non-linear audio curves: quiet → subtle; peaks → strong reactions
      const bassNL = Math.pow(Math.max(0, audioData.bass), 0.65) * 1.4
      const midNL  = Math.pow(Math.max(0, audioData.mid),  0.80) * 1.2
      const hiNL   = audioData.hi * audioData.hi * 2.5
      const subNL  = Math.pow(Math.max(0, audioData.sub),  0.70) * 1.1
      const predictedEnergy = Math.max(audioData.predictedEnergy ?? audioData.energyEnvelope ?? 0, audioData.energy ?? 0)
      const beatPhase = audioData.beatPhase ?? 0
      const beatConfidence = audioData.beatConfidence ?? 0
      const beatPulse = Math.exp(-Math.pow(Math.min(beatPhase, 1 - beatPhase) * 6.0, 2.0)) * beatConfidence

      const coreTarget = Math.min(1, predictedEnergy * 0.72 + subNL * 0.20 + bassNL * 0.18 + beatPulse * 0.10)
      const surfaceTarget = Math.min(1, midNL * 0.52 + hiNL * 0.22 + (audioData.onset ?? 0) * 0.18 + predictedEnergy * 0.18)
      const particleTarget = Math.min(1, predictedEnergy * 0.58 + hiNL * 0.22 + beatPulse * 0.28)
      visualState.coreEnergy += (coreTarget - visualState.coreEnergy) * (1 - Math.exp(-dt / (coreTarget > visualState.coreEnergy ? 0.09 : 0.85)))
      visualState.surfaceEnergy += (surfaceTarget - visualState.surfaceEnergy) * (1 - Math.exp(-dt / (surfaceTarget > visualState.surfaceEnergy ? 0.16 : 0.45)))
      visualState.particleEnergy += (particleTarget - visualState.particleEnergy) * (1 - Math.exp(-dt / 0.32))
      visualState.beatPhase += (beatPhase - visualState.beatPhase) * (1 - Math.exp(-dt / 0.16))
      visualState.palettePhase += dt * (0.018 + smoothed.speed * 0.018) + predictedEnergy * dt * 0.035 + colorShift * dt * 0.010

      const modeTargets = [
        { cameraDistance: 2.8, radial: 0.05, vortex: 0.00, collapse: 0.00, orbit: 0.00 },
        { cameraDistance: 1.2, radial: 0.85, vortex: 0.10, collapse: 0.00, orbit: 0.00 },
        { cameraDistance: 2.2, radial: 0.15, vortex: 1.00, collapse: 0.00, orbit: 0.00 },
        { cameraDistance: 2.4, radial: 0.25, vortex: 0.08, collapse: 1.00, orbit: 0.00 },
        { cameraDistance: 3.0, radial: 0.10, vortex: 0.00, collapse: 0.00, orbit: 1.00 },
      ]
      const modeTarget = modeTargets[mode] ?? modeTargets[0]
      const modeLerp = 1 - Math.exp(-dt / 0.72)
      const targetCameraDistance = Math.max(0.7, Math.min(4.0, modeTarget.cameraDistance + cameraDistance))
      visualState.cameraDistance += (targetCameraDistance - visualState.cameraDistance) * modeLerp
      visualState.modeBlend.x += (modeTarget.radial - visualState.modeBlend.x) * modeLerp
      visualState.modeBlend.y += (modeTarget.vortex - visualState.modeBlend.y) * modeLerp
      visualState.modeBlend.z += (modeTarget.collapse - visualState.modeBlend.z) * modeLerp
      visualState.modeBlend.w += (modeTarget.orbit - visualState.modeBlend.w) * modeLerp

      // Cross-band products: EMA smoothed, tau ~0.1s
      const crossLerp = 1 - Math.exp(-dt / 0.10)
      smoothBassMid += (bassNL * midNL - smoothBassMid) * crossLerp
      smoothMidHi   += (midNL  * hiNL  - smoothMidHi)  * crossLerp
      smoothBassHi  += (bassNL * hiNL  - smoothBassHi)  * crossLerp

      // bass+hi spike → inject a center force (kick + cymbal "pop")
      if (smoothBassHi > 0.35 && (elapsed - lastBassSpawn) > 0.4) {
        spawnForce(0, 0, smoothBassHi * 0.6, 1, 0.5, 0.4)
        lastBassSpawn = elapsed
      }

      // Camera drift accumulator: integrate sub-bass into a slow-decaying 2D offset.
      // The oscillating accumulation directions ensure the drift wanders rather than
      // converging on a fixed axis.
      const driftScale = subNL * smoothed.intensity * 0.0015
      camDrift.x = camDrift.x * 0.9975 + Math.sin(elapsed * 0.17) * driftScale
      camDrift.y = camDrift.y * 0.9975 + Math.cos(elapsed * 0.13) * driftScale
      mainUniforms.uCamDrift.value.copy(camDrift)

      // Update main uniforms
      mainUniforms.uTime.value       = elapsed
      mainUniforms.uBass.value       = bassNL * smoothed.intensity
      mainUniforms.uMid.value        = midNL  * smoothed.intensity
      mainUniforms.uHi.value         = hiNL   * smoothed.intensity
      mainUniforms.uSub.value        = subNL  * smoothed.intensity
      mainUniforms.uSpeed.value      = smoothed.speed
      mainUniforms.uIntensity.value  = smoothed.intensity
      mainUniforms.uColorShift.value = smoothed.colorShift
      mainUniforms.uChaos.value      = smoothed.chaos
      mainUniforms.uMode.value       = mode
      mainUniforms.uMouse.value.set(smoothedMouse.x * aspect, smoothedMouse.y)
      mainUniforms.uMouseVel.value   = mouseVel
      mainUniforms.uMouseDir.value.set(mouseDirSmooth.x, mouseDirSmooth.y)
      for (let i = 0; i < MAX_FORCES; i++) {
        const f = forces[i]
        if (f.age < 1.0) {
          mainUniforms.uForces.value[i].set(f.x, f.y, f.strength, f.age)
          mainUniforms.uForceMeta.value[i].set(f.velX, f.velY, f.radius, 0)
        } else {
          mainUniforms.uForces.value[i].set(0, 0, 0, 1)
          mainUniforms.uForceMeta.value[i].set(0, 0, 0, 0)
        }
      }
      mainUniforms.uEnergy.value     = controller.energy
      mainUniforms.uBassMid.value    = smoothBassMid
      mainUniforms.uMidHi.value      = smoothMidHi
      mainUniforms.uBassHi.value     = smoothBassHi
      mainUniforms.uCoreEnergy.value = visualState.coreEnergy
      mainUniforms.uSurfaceEnergy.value = visualState.surfaceEnergy
      mainUniforms.uParticleEnergy.value = visualState.particleEnergy
      mainUniforms.uBeatPhase.value = visualState.beatPhase
      mainUniforms.uPalettePhase.value = visualState.palettePhase
      mainUniforms.uModeBlend.value.copy(visualState.modeBlend)
      mainUniforms.uCameraDistance.value = visualState.cameraDistance
      mainUniforms.uSpectralCentroid.value = audioData.spectralCentroid ?? 0
      mainUniforms.uSpectralFlux.value = audioData.spectralFlux ?? 0
      mainUniforms.uProcIntensity.value = procIntensity

      // Palette family: modes 0-1 = teal/green/violet, modes 2-4 = pink/purple/violet
      const paletteFamily = mode >= 2 ? 1 : 0
      smoothPaletteFamily += (paletteFamily - smoothPaletteFamily) * (1 - Math.exp(-dt / 0.55))
      mainUniforms.uPaletteFamily.value = paletteFamily
      mainUniforms.uPaletteFamilyBlend.value = smoothPaletteFamily
      // uPaletteShift: break events push toward pink; slow LFO paletteDrift wanders hue
      const targetShift = Math.max(0, Math.min(1,
        smoothstep05(bOut.breakIntensity, 0.5, 1.0) + (bOut.paletteDrift ?? 0) * 0.5
      ))
      mainUniforms.uPaletteShift.value  += (targetShift - mainUniforms.uPaletteShift.value) * (1 - Math.exp(-dt / 0.28))
      // Sync particle shader palette
      pMat.uniforms.uPaletteFamily.value = paletteFamily
      pMat.uniforms.uPaletteFamilyBlend.value = smoothPaletteFamily
      pMat.uniforms.uPaletteShift.value  = mainUniforms.uPaletteShift.value
      pMat.uniforms.uEnergy.value        = controller.energy
      pMat.uniforms.uParticleEnergy.value = visualState.particleEnergy
      pMat.uniforms.uBeatPhase.value      = visualState.beatPhase
      pMat.uniforms.uParticleDensity.value = particleDensity

      mainUniforms.uColorSpike.value = Math.max(0, mainUniforms.uColorSpike.value * 0.951)

      // Break-event distortion spike blended with collision spike (take max)
      smoothed.breakSpike += (bOut.breakIntensity - smoothed.breakSpike) * 0.10
      mainUniforms.uDistortionSpike.value = Math.max(
        Math.max(0, mainUniforms.uDistortionSpike.value * 0.919),
        smoothed.breakSpike
      )

      // Combined bass+hi boost: kick + cymbal together trigger distortion pulses
      const combinedBoost = bassNL * hiNL * smoothed.intensity * 2.5
      mainUniforms.uDistortionSpike.value = Math.max(
        mainUniforms.uDistortionSpike.value,
        combinedBoost
      )

      // State-driven trail decay: per-mode defaults blended with behavioral target
      const modeDecayDefaults = [0.84, 0.84, 0.86, 0.90, 0.82]
      const modeDecay = modeDecayDefaults[mode] ?? 0.84
      const userDecayOffset = trailDecay - 0.84
      const baseDecay = Math.max(0.70, Math.min(0.94, (bOut.trailDecay ?? modeDecay) + userDecayOffset))
      const minDecay  = baseDecay - 0.04
      const transitionHold = (1 - modeTransition) * 0.12
      const targetDecay = Math.min(0.94, Math.max(minDecay, baseDecay - mainUniforms.uBass.value * 0.04) + transitionHold)
      const trailTau = transitionHold > 0.01 ? 0.12 : 0.22
      smoothTrailDecay += (targetDecay - smoothTrailDecay) * (1 - Math.exp(-dt / trailTau))
      trailUniforms.uDecay.value = smoothTrailDecay
      trailUniforms.uEnergy.value = visualState.particleEnergy
      trailUniforms.uBeatPhase.value = visualState.beatPhase

      // Pass 1: main shader → rtA
      // Clear finalUniforms so Three.js doesn't keep trailWrite's texture bound
      // while we switch framebuffers — stale bindings trigger the feedback loop.
      finalUniforms.uCurrent.value = null
      renderer.setRenderTarget(rtA)
      renderer.render(scene, camera)

      // Pass 2: blend(rtA, trailRead) → trailWrite
      // trailRead and trailWrite are always different targets (ping-pong rtB/rtC).
      trailUniforms.uCurrent.value = rtA.texture
      trailUniforms.uPrev.value    = trailRead.texture
      renderer.setRenderTarget(trailWrite)
      renderer.render(trailScene, camera)

      // Pass 3: trailWrite → screen
      // Clear trail uniforms before binding trailWrite as a sampler.
      trailUniforms.uCurrent.value = null
      trailUniforms.uPrev.value    = null
      finalUniforms.uCurrent.value = trailWrite.texture
      renderer.setRenderTarget(null)
      renderer.render(finalScene, camera)

      // Particle atmosphere follows delayed predicted energy instead of raw treble spikes.
      const hiVal = Math.min(1, visualState.particleEnergy * smoothed.intensity)
      const density = Math.max(0, particleDensity)
      const spawnRate = hiVal * (2.0 + beatConfidence * 2.2) * density
      if (density > 0.01 && hiVal > lastHi * 0.92 && hiVal > 0.12) {
        const wholeSpawns = Math.floor(spawnRate)
        const spawns = wholeSpawns + (Math.random() < spawnRate - wholeSpawns ? 1 : 0)
        for (let s = 0; s < spawns; s++) {
          const depth = 0.4 + Math.random() * 0.6
          const spawnMode = Math.random() < modeTransition ? mode : particleBlendFromMode
          spawnParticleForMode(spawnMode, hiVal, depth)
        }
      }
      lastHi = hiVal

      // Ambient idle dust (1 particle/sec max) — keeps life visible at silence
      if (density > 0.05 && bOut.state === 'calm' && Math.random() < dt * Math.min(1.2, 0.25 + density * 0.75)) {
        spawnParticle(
          Math.random() * 2 - 1, Math.random() * 2 - 1,
          (Math.random() - 0.5) * 0.002, (Math.random() - 0.5) * 0.002,
          3.0 + Math.random() * 2.0, 0, 0.3 + Math.random() * 0.3)
      }

      // Blob-collision burst: spark particles ejected radially from blob surface
      if (blobBurstPending > 0) {
        const count = blobBurstPending
        blobBurstPending = 0
        for (let s = 0; s < count; s++) {
          const angle = Math.random() * Math.PI * 2
          const r     = 0.30 + Math.random() * 0.10
          const spd   = 0.005 + Math.random() * 0.005
          spawnParticle(
            Math.cos(angle) * r, Math.sin(angle) * r,
            Math.cos(angle) * spd, Math.sin(angle) * spd,
            1.0 + Math.random() * 1.0, 1, 0.5 + Math.random() * 0.5)
        }
      }

      // Update live particles: drag + force field coupling
      for (let i = 0; i < MAX_PARTICLES; i++) {
        if (ages[i] < lives[i]) {
          ages[i] += 1 / 60
          velocities[i].x *= 0.997
          velocities[i].y *= 0.997
          // Sample force field: particles flow with the same forces as the shader
          const px = positions[i * 3], py = positions[i * 3 + 1]
          for (let k = 0; k < MAX_FORCES; k++) {
            const f = forces[k]
            if (f.age >= 1.0) continue
            const dx = px - f.x, dy = py - f.y
            const d2 = dx * dx + dy * dy
            const r2 = f.radius * f.radius
            const falloff = Math.exp(-d2 / Math.max(r2, 0.0001))
            const d = Math.sqrt(d2) || 1
            const sign = f.strength > 0 ? 1 : -1
            velocities[i].x += falloff * sign * (dx / d) * Math.abs(f.strength) * (1 - f.age) * 0.0003
            velocities[i].y += falloff * sign * (dy / d) * Math.abs(f.strength) * (1 - f.age) * 0.0003
          }
          // Curl noise: divergence-free field adds drift that matches the blob's flow
          const curl = curlNoise(px * 1.8, py * 1.8, elapsed)
          const curlStrength = 0.00012 * (1 + smoothMidHi * 2.0)
          velocities[i].x += curl.x * curlStrength
          velocities[i].y += curl.y * curlStrength

          positions[i * 3]     += velocities[i].x
          positions[i * 3 + 1] += velocities[i].y
        }
      }
      pGeo.attributes.position.needsUpdate = true
      pGeo.attributes.aAge.needsUpdate     = true
      pGeo.attributes.aType.needsUpdate    = true
      pGeo.attributes.aDepth.needsUpdate   = true

      renderer.autoClear = false
      renderer.render(particleScene, particleCamera)
      renderer.autoClear = true

      // ── Gesture detection (~10 Hz: every 6 frames) ─────────────────────────
      if (frameCount % 6 === 0) {
        const nowMs = performance.now()
        const { addDiscovery, discoveries } = useStore.getState()

        if (!discoveries.includes('circle') && detectCircle(nowMs)) {
          addDiscovery('circle')
          // Color spike + a ring of chain pulses
          mainUniforms.uColorSpike.value = Math.min(1.0, mainUniforms.uColorSpike.value + 0.7)
          mainUniforms.uDistortionSpike.value = Math.min(1.2, mainUniforms.uDistortionSpike.value + 0.5)
          const angles = [0, Math.PI * 0.66, Math.PI * 1.33]
          angles.forEach((a, i) => setTimeout(() => {
            spawnPulse(Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0.7, 0.6, 'chain', 0)
          }, i * 60))
          controller.injectEnergy(0.12)
        }

        if (!discoveries.includes('figure8') && detectFigure8(nowMs)) {
          addDiscovery('figure8')
          // Palette shift spike
          mainUniforms.uColorSpike.value = Math.min(1.0, mainUniforms.uColorSpike.value + 1.0)
          mainUniforms.uPaletteShift.value = Math.min(1.0, mainUniforms.uPaletteShift.value + 0.8)
          spawnPulse(0, 0, 0.9, 0.5, 'chain', 0)
          controller.injectEnergy(0.15)
        }

        if (!discoveries.includes('rapidClick') && detectRapidClick(nowMs)) {
          addDiscovery('rapidClick')
          // Distortion storm: 5 rapid pulses from center
          for (let k = 0; k < 5; k++) {
            setTimeout(() => spawnPulse(
              (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2,
              0.75, 0.8, 'click', 0
            ), k * 40)
          }
          mainUniforms.uDistortionSpike.value = Math.min(1.2, mainUniforms.uDistortionSpike.value + 1.0)
          controller.injectEnergy(0.18)
        }

      }

      // Ping-pong swap: trailWrite becomes trailRead next frame
      const tmp = trailRead; trailRead = trailWrite; trailWrite = tmp
    }

    rafId = requestAnimationFrame(tick)

    cleanupRef.current = () => {
      cancelAnimationFrame(rafId)
      clearTimeout(cursorHideTimer)
      resetGestureState()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('mousemove', onMouseMove)
      canvasRef.current?.removeEventListener('mousedown', onMouseDown)
      canvasRef.current?.removeEventListener('mouseup', onMouseUp)
      canvasRef.current?.removeEventListener('touchmove', onTouchMove)
      canvasRef.current?.removeEventListener('touchstart', onTouchStart)
      canvasRef.current?.removeEventListener('touchend', onTouchEnd)
      renderer.dispose()
      mainMat.dispose()
      trailMat.dispose()
      finalMat.dispose()
      pMat.dispose()
      pGeo.dispose()
      rtA.dispose()
      rtB.dispose()
      rtC.dispose()
    }

    return cleanupRef.current
  }, [canvasRef])
}
