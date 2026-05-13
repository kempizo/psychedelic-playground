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
      uLowMid:     { value: 0 },
      uMid:        { value: 0 },
      uHighMid:    { value: 0 },
      uTreble:     { value: 0 },
      uHi:         { value: 0 },
      uSub:        { value: 0 },
      uRms:        { value: 0 },
      uOnset:      { value: 0 },
      uBassPulse:  { value: 0 },
      uMidPulse:   { value: 0 },
      uTreblePulse:{ value: 0 },
      uSilence:    { value: 1 },
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
      uEngineA:        { value: new THREE.Vector4(1, 0, 0, 0) },
      uEngineB:        { value: new THREE.Vector4(0, 0, 0, 0) },
      uEngineC:        { value: new THREE.Vector4(0, 0, 0, 0) },
      uEngineD:        { value: new THREE.Vector4(0, 0, 0, 0) },
      // Tunnel/portal depth layer (Stage 11) — internal only
      uTunnelA:        { value: new THREE.Vector4(0, 0, 0, 0) },
      uTunnelB:        { value: new THREE.Vector4(0, 0, 0, 0) },
      // Throat carve axis (Slice A): defaults to +Y (cap-aligned). A future
      // slice will lerp this toward camera-forward as journey/intensity rise
      // for a stronger pulled-through-the-portal feel in Gills/Spiral/Pulse.
      uThroatAxis:     { value: new THREE.Vector3(0, 1, 0) },
      uCameraDistance:{ value: 2.8 },
      uSpectralCentroid: { value: 0 },
      uSpectralFlux: { value: 0 },
      uProcIntensity: { value: 0.45 },
      uAudioBody: { value: 0 },
      uAudioMorph: { value: 0 },
      uAudioDetail: { value: 0 },
      uAudioPulse: { value: 0 },
      uAudioBrightness: { value: 0 },
      uAudioTurbulence: { value: 0 },
      // Packed musical lane uniforms — direct authority over tunnel/throat/vein terms
      uAudioDriveA: { value: new THREE.Vector4(0, 0, 0, 0) }, // x=subBody, y=bassPunch, z=midMotion, w=highSparkle
      uAudioDriveB: { value: new THREE.Vector4(0, 0, 0, 0) }, // x=brightness, y=fluxPulse, z=motionEnergy, w=silenceAmount
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
      uFlow: { value: 0 },
      uOnset: { value: 0 },
      uTreble: { value: 0 },
      uAudioDetail: { value: 0 },
      uAudioTurbulence: { value: 0 },
      uTreblePulse: { value: 0 },
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
        uTreblePulse: { value: 0 },
        uOnset: { value: 0 },
        uAudioBody: { value: 0 },
        uAudioDetail: { value: 0 },
        uAudioTurbulence: { value: 0 },
        uSilence: { value: 1 },
        uMandelPhase: { value: 0 },
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
    let activePointerId = null

    const resetCursorTimer = () => {
      clearTimeout(cursorHideTimer)
      if (canvasRef.current) canvasRef.current.style.cursor = ''
      cursorHideTimer = setTimeout(() => {
        if (!isHolding && canvasRef.current) canvasRef.current.style.cursor = 'none'
      }, 3000)
    }

    const updatePointerFromEvent = (e) => {
      const rect = canvasRef.current.getBoundingClientRect()
      rawMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      rawMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }

    const onPointerMove = (e) => {
      resetCursorTimer()
      if (!isHolding || e.pointerId !== activePointerId) return
      e.preventDefault()
      updatePointerFromEvent(e)
      pushMousePos(rawMouse.x, rawMouse.y)
    }
    canvasRef.current.addEventListener('pointermove', onPointerMove)

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

    const spawnInteractionForce = (x, y, strength, sign = 1, radius = 0.35, tau = 0.6, vx = 0, vy = 0) => {
      spawnForce(x, y, strength, sign, radius, tau, vx, vy)
    }

    const spawnAudioBreath = (x, y, energy, sign = 1) => {
      spawnForce(x, y, energy, sign, 0.72, 0.85)
    }

    // Gesture discoveries remain interaction-driven, but use a softer force than
    // direct pointer clicks so they do not read as accidental click ripples.
    const spawnGestureForce = (x, y, energy) => {
      spawnForce(x, y, energy * 0.68, 1, 0.46, 0.45, mouseDirSmooth.x * 0.03, mouseDirSmooth.y * 0.03)
    }

    // type: 0=dust, 1=ember, 2=spore
    const spawnParticle = (px, py, vx, vy, life, type = 1, depth = null) => {
      for (let i = 0; i < MAX_PARTICLES; i++) {
        if (ages[i] < lives[i]) continue
        positions[i * 3]     = px
        positions[i * 3 + 1] = py
        positions[i * 3 + 2] = 0
        ages[i]   = 0
        lives[i]  = life
        ptypes[i] = type
        pdepths[i]= depth !== null ? clamp01(depth) : 0.4 + Math.random() * 0.6
        velocities[i].x = vx
        velocities[i].y = vy
        break
      }
    }

    const countLivingParticles = () => {
      let count = 0
      for (let i = 0; i < MAX_PARTICLES; i++) {
        if (ages[i] < lives[i]) count++
      }
      return count
    }

    const onPointerDown = (e) => {
      if (!e.isPrimary) return
      if (e.target !== canvasRef.current) return
      e.preventDefault()
      activePointerId = e.pointerId
      canvasRef.current.setPointerCapture?.(e.pointerId)
      updatePointerFromEvent(e)
      const x = rawMouse.x
      const y = rawMouse.y
      pushClickTime(performance.now())
      // Default click = soft inward growth attractor (organism leans toward
      // touch point). Shift+click = outward release. Wider radius + longer
      // tau than the old impact ripple so it reads as influence, not shock.
      const sign = e.shiftKey ? 1 : -1
      spawnInteractionForce(x, y, 0.22, sign, 0.55, 1.1, mouseDirSmooth.x * 0.05, mouseDirSmooth.y * 0.05)
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
    const onPointerUp = (e) => {
      if (activePointerId !== null && e.pointerId !== activePointerId) return
      isHolding = false
      if (activePointerId !== null) canvasRef.current.releasePointerCapture?.(activePointerId)
      activePointerId = null
      canvasRef.current.style.cursor = ''
    }
    canvasRef.current.addEventListener('pointerdown', onPointerDown)
    canvasRef.current.addEventListener('pointerup', onPointerUp)
    canvasRef.current.addEventListener('pointercancel', onPointerUp)

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
    const smoothed = {
      speed: s0,
      intensity: i0,
      colorShift: c0,
      chaos: ch0,
      trailDecay: td0,
      cameraDistance: cd0,
      procIntensity: pi0,
      particleDensity: pd0,
      breakSpike: 0,
    }

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
    let pendingTrailClearFrames = 0
    // Slice 6 — Journey phase multipliers. Eased toward target each frame with
    // tau ≈ 1.2s so phase transitions never thrash. Drive spore density,
    // portal bloom, tunnel pull, trail decay, palette heat, and layer leadership.
    const phaseMul = {
      spore: 0.78,
      portal: 0.58,
      tunnelPull: 0.72,
      trailDecay: 0.86,
      colorHeat: 0.45,
      mandelReveal: 0.34,
      myceliumReveal: 0.62,
    }
    const visualState = {
      coreEnergy: 0,
      surfaceEnergy: 0,
      particleEnergy: 0,
      beatPhase: 0,
      palettePhase: c0,
      cameraDistance: 2.8,
      modeBlend: new THREE.Vector4(0, 0, 0, 0),
      engineA: new THREE.Vector4(1, 0, 0, 0),
      engineB: new THREE.Vector4(0, 0, 0, 0),
      engineC: new THREE.Vector4(0, 0, 0, 0),
      engineD: new THREE.Vector4(0, 0, 0, 0),
      // Stage 11 tunnel/portal: smoothed render-loop-local depth-field controls
      // A: x=depth, y=inward, z=gills, w=spiral
      // B: x=breath, y=portalBloom, z=growthWaveAge, w=growthWaveAmp
      tunnelA: new THREE.Vector4(0, 0, 0, 0),
      tunnelB: new THREE.Vector4(0, 0, 0, 0),
      audioBody: 0,
      audioMorph: 0,
      audioDetail: 0,
      audioPulse: 0,
      audioBrightness: 0,
      audioTurbulence: 0,
      // Direct musical lane states — packed into uAudioDriveA/B each frame
      laneSubBody: 0,
      laneBassPunch: 0,
      laneMidMotion: 0,
      laneHighSparkle: 0,
      laneBrightness: 0,
      laneFluxPulse: 0,
      laneMotionEnergy: 0,
      laneSilenceAmount: 0,
    }
    // uCamDrift accumulator: slowly integrates sub-bass, decays at 0.997/frame
    const camDrift = new THREE.Vector2(0, 0)
    // Smoothed cross-band products (EMA, tau ~0.1s)
    let smoothBassMid = 0, smoothMidHi = 0, smoothBassHi = 0
    // S6: render-loop-only journey scalar — aligns blob/trail/particles/EnergyIndicator
    const journey = { value: 0, transient: 0 }
    const growthWave = { age: 1, amp: 0, lastLaunch: -999 }
    const engineATarget = new THREE.Vector4()
    const engineBTarget = new THREE.Vector4()
    const engineCTarget = new THREE.Vector4()
    const engineDTarget = new THREE.Vector4()
    const tunnelATarget = new THREE.Vector4()
    // Slice C: smoothed throat-axis blend (0 = pure +Y, 1 = camera-forward)
    let smoothThroatAxisBlend = 0
    const modeAxisBias = [0.15, 0.55, 0.70, 0.65, 0.35] // Drift, Gills, Spiral, Pulse, Orbit

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
    const clamp01 = (v) => Math.max(0, Math.min(1, v))
    const randRange = (min, max) => min + Math.random() * (max - min)
    const particleDepth = (stratum, lift = 0) => {
      const activity = clamp01(lift)
      if (stratum === 'near') return Math.min(1, randRange(0.76, 0.98) + activity * 0.05)
      if (stratum === 'far') return Math.max(0.18, randRange(0.22, 0.44) - activity * 0.03)
      return randRange(0.48, 0.74) + activity * 0.04
    }
    const depthScale = (depth) => 0.42 + clamp01(depth) * 0.82
    const particleMaskProxy = {
      portalRadius: 0.18,
      gillRingRadius: 0.32,
      tunnelBandRadius: 0.25,
    }
    // Mutable audio lane refs accessible to spawn functions and updated each tick.
    let bassPunchLane = 0, midMotionLane = 0

    const spawnAnnulusSpore = (radius, hiVal, depth, silenceValue = 0, kind = 'tunnel') => {
      const safeRadius = Math.max(0.12, Math.min(0.94, radius))
      const quietGate = 1 - silenceValue * 0.68
      const angle = Math.random() * Math.PI * 2
      const scatter = Math.max(0.18 * safeRadius, kind === 'portal' ? 0.055 : 0.070)
      const r = Math.max(0.12, Math.min(1.04, safeRadius + randRange(-scatter, scatter)))
      const d = depth ?? particleDepth(kind === 'portal' ? 'near' : 'mid', hiVal)
      const parallax = depthScale(d)
      const detail = visualState.audioDetail
      const morph = visualState.audioMorph
      const pulse = visualState.audioPulse
      const tangentialSign = Math.random() < 0.5 ? -1 : 1
      const tangent = (0.0010 + detail * 0.0015 + morph * 0.0008) * parallax * tangentialSign
      const radialDrift = (kind === 'portal' ? -0.00055 : 0.00045) * parallax + pulse * 0.0012 * parallax
      spawnParticle(
        Math.cos(angle) * r,
        Math.sin(angle) * r,
        (Math.cos(angle) * radialDrift - Math.sin(angle) * tangent) * quietGate,
        (Math.sin(angle) * radialDrift + Math.cos(angle) * tangent) * quietGate,
        kind === 'portal' ? randRange(1.0, 1.95) : randRange(1.25, 2.25),
        2,
        d,
      )
    }

    const spawnParticleForMode = (spawnMode, hiVal, depth, silenceValue = 0) => {
      const body = visualState.audioBody
      const morph = visualState.audioMorph
      const detail = visualState.audioDetail
      const pulse = visualState.audioPulse
      const turbulence = visualState.audioTurbulence
      const quietGate = 1 - silenceValue * 0.72
      const activity = clamp01(hiVal * 0.45 + detail * 0.26 + pulse * 0.22 + body * 0.12)
      const drift = 0.0014 + hiVal * 0.0022 + detail * 0.0017
      // Slice G: audio-driven velocity scales (clamped per plan)
      const radialVelScale  = 1 + Math.min(bassPunchLane, 0.6) * 0.3
      const tangVelScale    = 1 + Math.min(midMotionLane, 0.7) * 0.5
      const annulusR = particleMaskProxy.tunnelBandRadius * 0.85
      const portalR  = particleMaskProxy.portalRadius * 0.85
      if (spawnMode === 2) {
        // Spiral: tangential bloom biased toward tunnel/portal annuli.
        const angle = Math.random() * Math.PI * 2
        const r = randRange(annulusR * 0.85, annulusR * 1.30 + body * 0.14) * 0.85
        const d = depth ?? particleDepth(Math.random() < 0.68 ? 'mid' : 'near', activity)
        const parallax = depthScale(d)
        const tang = (0.0027 + morph * 0.0028 + pulse * 0.0020) * parallax * tangVelScale
        const inward = (0.0007 + body * 0.0012 + turbulence * 0.0006) * parallax * radialVelScale
        const tangX = (-Math.sin(angle) * tang - Math.cos(angle) * inward) * quietGate
        const tangY = ( Math.cos(angle) * tang - Math.sin(angle) * inward) * quietGate
        spawnParticle(Math.cos(angle) * r, Math.sin(angle) * r,
          tangX, tangY, 1.5 + Math.random() * 1.55, Math.random() < 0.46 ? 1 : 2, d)
      } else if (spawnMode === 3) {
        // Pulse: inward mycelium branches from tunnel band radius.
        const angle = Math.random() * Math.PI * 2
        const r = randRange(annulusR * 0.90, annulusR * 1.30) * 0.85
        const cx = Math.cos(angle) * r, cy = Math.sin(angle) * r
        const n = Math.sqrt(cx * cx + cy * cy) || 1
        const d = depth ?? particleDepth(Math.random() < 0.72 ? 'mid' : 'near', activity)
        const parallax = depthScale(d)
        const inward = (0.0017 + body * 0.0022 + morph * 0.0008) * parallax * radialVelScale
        const release = pulse * 0.0028 * parallax * tangVelScale
        spawnParticle(cx, cy, (-cx / n * inward + Math.cos(angle) * release) * quietGate, (-cy / n * inward + Math.sin(angle) * release) * quietGate,
          1.75 + Math.random() * 1.8, 2, d)
      } else if (spawnMode === 4) {
        // Orbit: seam-biased shimmer clustered at portal/band radius.
        const seam = Math.floor(Math.random() * 3) * (Math.PI * 2 / 3)
        const angle = seam + (Math.random() - 0.5) * (0.42 + turbulence * 0.24) + Math.sin(timer.getElapsed() * 0.17 + seam) * 0.12
        const r = randRange(portalR * 0.70, annulusR * 0.90 + morph * 0.07) * 0.85
        const d = depth ?? particleDepth(Math.random() < 0.72 ? 'mid' : 'far', activity)
        const parallax = depthScale(d)
        const tang = (0.0011 + detail * 0.0018) * parallax * tangVelScale
        const seamDrift = (Math.random() - 0.5) * 0.0008 * parallax * radialVelScale
        spawnParticle(Math.cos(angle) * r, Math.sin(angle) * r,
          (-Math.sin(angle) * tang + Math.cos(seam) * seamDrift) * quietGate,
          ( Math.cos(angle) * tang + Math.sin(seam) * seamDrift) * quietGate,
          1.7 + Math.random() * 1.55, Math.random() < 0.56 ? 1 : 0, d)
      } else if (spawnMode === 1) {
        // Gills: mandala arcs biased toward gill ring radius.
        const spoke = Math.floor(Math.random() * 8) * (Math.PI * 2 / 8)
        const angle = spoke + (Math.random() - 0.5) * (0.20 + morph * 0.32)
        const r = randRange(annulusR * 0.60, annulusR * 1.20) * 0.85
        const d = depth ?? particleDepth(Math.random() < 0.66 ? 'mid' : 'far', activity)
        const parallax = depthScale(d)
        const breathe = (0.0009 + body * 0.0018 + pulse * 0.0013) * quietGate * parallax * radialVelScale
        const tangent = (Math.random() - 0.5) * drift * parallax * tangVelScale
        spawnParticle(Math.cos(angle) * r, Math.sin(angle) * r,
          (Math.cos(angle) * breathe - Math.sin(angle) * tangent),
          (Math.sin(angle) * breathe + Math.cos(angle) * tangent),
          2.0 + Math.random() * 2.1, Math.random() < 0.58 ? 0 : 2, d)
      } else {
        // Drift: tunnel-rim dust at band radius, curl-carried.
        const angle = Math.random() * Math.PI * 2
        const r = randRange(annulusR * 0.80, annulusR * 1.40) * 0.85
        const side = Math.random() < 0.5 ? -1 : 1
        const rimX = Math.cos(angle) * r * side
        const rimY = Math.sin(angle) * r
        const curl = curlNoise(rimX * 1.6, rimY * 1.6, timer.getElapsed())
        const d = depth ?? particleDepth(Math.random() < 0.68 ? 'far' : 'mid', activity)
        const parallax = depthScale(d)
        const c = (0.0008 + turbulence * 0.0015 + detail * 0.0009 + morph * 0.0006) * parallax
        spawnParticle(
          rimX, rimY,
          (curl.x * c * tangVelScale + (Math.random() - 0.5) * 0.0008 * parallax * radialVelScale) * quietGate,
          (curl.y * c * tangVelScale + 0.00035 * parallax * radialVelScale + (Math.random() - 0.5) * 0.0008 * parallax) * quietGate,
          2.4 + Math.random() * 2.3, Math.random() < 0.74 ? 0 : 2, d)
      }
    }

    const spawnGrowthWaveSpores = (count, strength, preferredMode, silenceValue = 0) => {
      const quietGate = 1 - silenceValue * 0.62
      const safeCount = Math.min(8, Math.max(0, count))
      for (let s = 0; s < safeCount; s++) {
        const angle = Math.random() * Math.PI * 2
        const gillRadius = particleMaskProxy.gillRingRadius
        const rimScatter = Math.max(0.18 * gillRadius, 0.07)
        const rim = Math.max(0.24, Math.min(0.94, gillRadius + randRange(-rimScatter, rimScatter)))
        const d = particleDepth(s % 3 === 0 ? 'near' : 'mid', strength)
        const parallax = depthScale(d)
        const curl = curlNoise(Math.cos(angle) * 1.4, Math.sin(angle) * 1.4, timer.getElapsed() + s)
        const outward = (0.0012 + strength * 0.0022 + visualState.audioBody * 0.0008) * parallax * quietGate
        const tangent = (0.0007 + visualState.audioMorph * 0.0013 + visualState.audioDetail * 0.0010) * parallax * quietGate
        const type = s % 4 === 0 ? 1 : 2
        spawnParticle(
          Math.cos(angle) * rim,
          Math.sin(angle) * rim,
          Math.cos(angle) * outward + (-Math.sin(angle) * tangent + curl.x * 0.0007) * quietGate,
          Math.sin(angle) * outward + ( Math.cos(angle) * tangent + curl.y * 0.0007) * quietGate,
          randRange(1.15, 2.35),
          type,
          d,
        )
      }

      if (preferredMode === 2 || preferredMode === 3) {
        spawnParticleForMode(preferredMode, strength, particleDepth('mid', strength), silenceValue)
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
        const prevFamily = prevMode >= 2
        const nextFamily = mode >= 2
        particleBlendFromMode = prevMode
        modeTransitionTarget = 0
        modeTransitionHoldUntil = elapsed + 0.10
        pendingTrailClearFrames = prevFamily !== nextFamily ? 2 : 1
        prevMode = mode
      }
      if (modeTransitionTarget === 0 && elapsed >= modeTransitionHoldUntil) {
        modeTransitionTarget = 1
      }
      const modeTransitionTau = modeTransitionTarget === 0 ? 0.07 : 0.88
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
      const smoothVisualControl = (key, target, tau) => {
        smoothed[key] += (target - smoothed[key]) * (1 - Math.exp(-dt / tau))
      }
      smoothVisualControl('trailDecay', trailDecay, 0.30)
      smoothVisualControl('cameraDistance', cameraDistance, 0.34)
      smoothVisualControl('procIntensity', procIntensity, 0.28)
      smoothVisualControl('particleDensity', particleDensity, 0.38)

      // Bass auto-breath: broad centered pressure, separate from click/drag ripples.
      const curBass = audioData.bass
      if (curBass > lastBass * 1.3 && curBass > 0.35 && (elapsed - lastBassSpawn) > 0.3) {
        const energy = Math.min(curBass * smoothed.intensity * 0.24, 0.26)
        spawnAudioBreath(0, 0, energy)
        lastBassSpawn = elapsed
        controller.injectEnergy(0.03)
      }
      lastBass = curBass

      // Hold-and-drag: continuous small force at cursor, short tau → paints force
      if (isHolding && (elapsed - holdStartTime) > 0.15 && (elapsed - lastHoldSpawn) > 0.05) {
        const vx = rawMouse.x - prevRawMouse.x
        const vy = rawMouse.y - prevRawMouse.y
        // Drag paints a soft growth ridge — inward sign, wide & gentle.
        spawnInteractionForce(rawMouse.x, rawMouse.y, 0.08, -1, 0.40, 0.12, vx * 0.3, vy * 0.3)
        lastHoldSpawn = elapsed
      }

      // Push energy snapshot to store at ~20 Hz (every 3 frames) to avoid 60fps React updates
      frameCount++
      if (frameCount % 3 === 0) {
        useStore.getState().setEnergySnapshot({
          energy: clamp01(Math.max(controller.energy, journey.value)),
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
        mainUniforms.uDistortionSpike.value = Math.min(0.65, mainUniforms.uDistortionSpike.value + 0.45)
        spawnAudioBreath(0, 0, 0.18)
      }
      prevBehavioralState = bOut.state

      // Auto-mode virtual pulses are deliberately broad/centered so idle drift
      // cannot create click-like random impulse events.
      if (bOut.virtualPulse) {
        const vp = bOut.virtualPulse
        const vpSign = (bOut.forceBias ?? 0) < -0.5 ? -1 : 1
        spawnAudioBreath(0, 0, Math.min(vp.energy * 0.18, 0.16), vpSign)
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
      const bassRaw = Math.max(0, audioData.bass)
      const lowMidRaw = Math.max(0, audioData.lowMid ?? audioData.mid * 0.45)
      const midRaw = Math.max(0, audioData.mid)
      const highMidRaw = Math.max(0, audioData.highMid ?? audioData.hi * 0.7)
      const trebleRaw = Math.max(0, audioData.treble ?? audioData.hi * 0.5)
      const bassPulse = Math.max(0, audioData.bassPulse ?? audioData.onset ?? 0)
      const midPulse = Math.max(0, audioData.midPulse ?? 0)
      const treblePulse = Math.max(0, audioData.treblePulse ?? 0)
      const rms = Math.max(0, audioData.rms ?? audioData.energy ?? 0)
      const onset = Math.max(0, audioData.onset ?? 0)
      const silence = Math.max(0, Math.min(1, audioData.silence ?? 0))
      const motionEnergy = Math.max(0, Math.min(1, audioData.motionEnergy ?? 0))
      const fluxPulse = Math.max(0, Math.min(1, audioData.fluxPulse ?? 0))
      const silenceAmount = Math.max(0, Math.min(1, audioData.silenceAmount ?? silence))
      const subBodyLane = Math.max(0, Math.min(1, audioData.subBody ?? ((audioData.sub ?? 0) * 0.6 + (audioData.bass ?? 0) * 0.4)))
      bassPunchLane = Math.max(0, Math.min(1, audioData.bassPunch ?? bassPulse))
      midMotionLane = Math.max(0, Math.min(1, audioData.midMotion ?? ((audioData.mid ?? 0) * 0.7 + midPulse * 0.3)))
      const highSparkleLane = Math.max(0, Math.min(1, audioData.highSparkle ?? ((audioData.hi ?? 0) * 0.7 + treblePulse * 0.3)))
      const bassNL = Math.pow(bassRaw + bassPulse * 0.10, 0.65) * 1.4
      const lowMidNL = Math.pow(lowMidRaw, 0.76) * 1.15
      const midNL  = Math.pow(midRaw + midPulse * 0.08,  0.80) * 1.2
      const highMidNL = Math.pow(highMidRaw, 1.05) * 1.55
      const trebleNL = Math.pow(trebleRaw + treblePulse * 0.08, 1.15) * 1.65
      const hiNL   = Math.min(1.8, highMidNL * 0.75 + trebleNL * 0.85)
      const subNL  = Math.pow(Math.max(0, audioData.sub),  0.70) * 1.1
      const predictedEnergy = Math.max(audioData.predictedEnergy ?? audioData.energyEnvelope ?? 0, audioData.energy ?? 0)
      const beatPhase = audioData.beatPhase ?? 0
      const beatConfidence = audioData.beatConfidence ?? 0
      const beatPulse = Math.exp(-Math.pow(Math.min(beatPhase, 1 - beatPhase) * 6.0, 2.0)) * beatConfidence
      const centroid = clamp01(audioData.spectralCentroid ?? 0)
      const brightnessLane = Math.max(0, Math.min(1, audioData.brightness ?? centroid))
      const silenceGate = 1 - silence * 0.58
      const silenceHold = smoothstep05(silence, 0.55, 0.95)
      const idleBreath = silenceHold * (0.5 + 0.5 * Math.sin(elapsed * 0.56 + Math.sin(elapsed * 0.17) * 0.65))
      const idleBodyFloor = silenceHold * smoothed.intensity * (0.018 + idleBreath * 0.020)
      const idleCoreFloor = silenceHold * (0.026 + idleBreath * 0.024)
      const idleBrightnessFloor = silenceHold * smoothed.intensity * (0.012 + idleBreath * 0.012)
      const idleMotionGate = 1 - silenceHold * 0.42

      const audioTargets = {
        body: Math.max(idleBodyFloor, clamp01((subNL * 0.20 + bassNL * 0.32 + lowMidNL * 0.16 + subBodyLane * 0.30 + bassPunchLane * 0.18) * smoothed.intensity * silenceGate)),
        morph: clamp01((lowMidNL * 0.18 + midNL * 0.28 + highMidNL * 0.14 + midMotionLane * 0.36 + midPulse * 0.10) * smoothed.intensity * silenceGate),
        detail: clamp01((highMidNL * 0.18 + trebleNL * 0.22 + hiNL * 0.14 + highSparkleLane * 0.42 + treblePulse * 0.08) * smoothed.intensity * silenceGate),
        pulse: clamp01((bassPunchLane * 0.46 + fluxPulse * 0.20 + onset * 0.20 + midPulse * 0.12 + beatPulse * 0.12) * (1 - silenceAmount * 0.45)),
        brightness: Math.max(idleBrightnessFloor, clamp01((brightnessLane * 0.38 + centroid * 0.18 + rms * 0.24 + predictedEnergy * 0.12 + trebleNL * 0.08 + smoothed.intensity * 0.06) * (1 - silenceAmount * 0.46))),
        turbulence: clamp01((fluxPulse * 0.32 + motionEnergy * 0.24 + midMotionLane * 0.16 + treblePulse * 0.14 + onset * 0.08) * (1 - silenceAmount * 0.58)),
      }
      const smoothAudio = (key, target, attackTau, releaseTau) => {
        const prev = visualState[key]
        const tau = target > prev ? attackTau : releaseTau
        visualState[key] = clamp01(prev + (target - prev) * (1 - Math.exp(-dt / tau)))
      }
      smoothAudio('audioBody', audioTargets.body, 0.10, 0.70)
      smoothAudio('audioMorph', audioTargets.morph, 0.14, 0.55)
      smoothAudio('audioDetail', audioTargets.detail, 0.08, 0.36)
      smoothAudio('audioPulse', audioTargets.pulse, 0.05, 0.34)
      smoothAudio('audioBrightness', audioTargets.brightness, 0.12, 0.50)
      smoothAudio('audioTurbulence', audioTargets.turbulence, 0.06, 0.28)
      // Direct musical lane smoothing — each lane has dedicated authority in the shader
      smoothAudio('laneSubBody',      subBodyLane,      0.16, 0.55)
      smoothAudio('laneBassPunch',    bassPunchLane,    0.04, 0.22)
      smoothAudio('laneMidMotion',    midMotionLane,    0.10, 0.32)
      smoothAudio('laneHighSparkle',  highSparkleLane,  0.06, 0.20)
      smoothAudio('laneBrightness',   brightnessLane,   0.12, 0.48)
      smoothAudio('laneFluxPulse',    fluxPulse,        0.03, 0.18)
      smoothAudio('laneMotionEnergy', motionEnergy,     0.12, 0.36)
      smoothAudio('laneSilenceAmount',silenceAmount,    0.16, 0.42)

      const coreTarget = Math.max(idleCoreFloor, Math.min(1, predictedEnergy * 0.48 + rms * 0.12 + subNL * 0.12 + subBodyLane * 0.22 + bassPunchLane * 0.16 + beatPulse * 0.08))
      const surfaceTarget = Math.min(1, lowMidNL * 0.16 + midNL * 0.24 + highMidNL * 0.10 + midMotionLane * 0.30 + predictedEnergy * 0.12 + fluxPulse * 0.08)
      const particleTarget = Math.min(1, predictedEnergy * 0.34 + highMidNL * 0.10 + trebleNL * 0.12 + highSparkleLane * 0.28 + treblePulse * 0.12 + beatPulse * 0.18) * idleMotionGate * (1 - silenceAmount * 0.18)
      visualState.coreEnergy += (coreTarget - visualState.coreEnergy) * (1 - Math.exp(-dt / (coreTarget > visualState.coreEnergy ? 0.09 : 0.85)))
      visualState.surfaceEnergy += (surfaceTarget - visualState.surfaceEnergy) * (1 - Math.exp(-dt / (surfaceTarget > visualState.surfaceEnergy ? 0.16 : 0.45)))
      visualState.particleEnergy += (particleTarget - visualState.particleEnergy) * (1 - Math.exp(-dt / 0.32))
      visualState.beatPhase += (beatPhase - visualState.beatPhase) * (1 - Math.exp(-dt / 0.16))
      const afterglowColorSlowdown = bOut.state === 'afterglow' ? 0.48 : 1
      const colorDriftRate = (0.0045 + smoothed.speed * 0.0035 + predictedEnergy * 0.006 + visualState.audioBrightness * 0.003) * afterglowColorSlowdown
      visualState.palettePhase += dt * colorDriftRate + smoothed.colorShift * dt * 0.004

      const modeTargets = [
        { cameraDistance: 2.8, radial: 0.05, vortex: 0.00, collapse: 0.00, orbit: 0.00 },
        { cameraDistance: 1.2, radial: 0.85, vortex: 0.10, collapse: 0.00, orbit: 0.00 },
        { cameraDistance: 2.2, radial: 0.15, vortex: 1.00, collapse: 0.00, orbit: 0.00 },
        { cameraDistance: 2.4, radial: 0.25, vortex: 0.08, collapse: 1.00, orbit: 0.00 },
        { cameraDistance: 3.0, radial: 0.10, vortex: 0.00, collapse: 0.00, orbit: 1.00 },
      ]
      const modeTarget = modeTargets[mode] ?? modeTargets[0]
      const modeLerp = 1 - Math.exp(-dt / 0.82)
      const targetCameraDistance = Math.max(0.7, Math.min(4.0, modeTarget.cameraDistance + smoothed.cameraDistance))
      visualState.cameraDistance += (targetCameraDistance - visualState.cameraDistance) * modeLerp
      visualState.modeBlend.x += (modeTarget.radial - visualState.modeBlend.x) * modeLerp
      visualState.modeBlend.y += (modeTarget.vortex - visualState.modeBlend.y) * modeLerp
      visualState.modeBlend.z += (modeTarget.collapse - visualState.modeBlend.z) * modeLerp
      visualState.modeBlend.w += (modeTarget.orbit - visualState.modeBlend.w) * modeLerp

      // Cross-band products: EMA smoothed, tau ~0.1s
      const crossLerp = 1 - Math.exp(-dt / 0.10)
      smoothBassMid += (bassNL * (lowMidNL * 0.45 + midNL * 0.55) - smoothBassMid) * crossLerp
      smoothMidHi   += ((midNL * 0.55 + highMidNL * 0.45) * hiNL - smoothMidHi)  * crossLerp
      smoothBassHi  += (bassNL * (highMidNL * 0.45 + trebleNL * 0.55) - smoothBassHi)  * crossLerp

      // S6: journey scalar — per-state floor/ceiling keeps calm<build<peak>afterglow arc
      const stateFloors = { calm: 0.0, build: 0.05, peak: 0.18, afterglow: 0.0 }
      const stateCeils  = { calm: 0.55, build: 0.85, peak: 1.0,  afterglow: 0.72 }
      const stFloor = stateFloors[bOut.state] ?? 0.0
      const stCeil  = stateCeils[bOut.state]  ?? 1.0
      const journeyTarget = clamp01(Math.min(stCeil, Math.max(stFloor,
        controller.energy * 0.38 + predictedEnergy * 0.26 + visualState.audioBody * 0.10 + visualState.audioBrightness * 0.10 + visualState.coreEnergy * 0.04
      )))
      const journeyTransientTarget = clamp01(visualState.audioPulse * 0.35 + onset * 0.25)
      const journeyAttack   = 1 - Math.exp(-dt / 0.10)
      const journeyRelease  = 1 - Math.exp(-dt / 0.55)
      const journeyTAttack  = 1 - Math.exp(-dt / 0.04)
      const journeyTRelease = 1 - Math.exp(-dt / 0.30)
      journey.value     = clamp01(journey.value     + (journeyTarget          - journey.value)     * (journeyTarget          > journey.value     ? journeyAttack  : journeyRelease))
      journey.transient = clamp01(journey.transient + (journeyTransientTarget - journey.transient) * (journeyTransientTarget > journey.transient ? journeyTAttack : journeyTRelease))

      // Slice 6 — Journey phase. Derived from behavioralState + journey scalar
      // + silence. Phase multipliers ease over tau ≈ 1.2s so the transitions
      // inherit existing behavioral hysteresis without thrashing.
      let phase = 'breathing-organism'
      if (silence > 0.6 && journey.value < 0.18) phase = 'idle-mycelium'
      else if (bOut.state === 'build') phase = 'gills-portal-pull'
      else if (bOut.state === 'peak') phase = 'bloom-breakthrough'
      else if (bOut.state === 'afterglow') phase = 'afterglow'
      else if (bOut.state === 'calm' && silence < 0.4) phase = 'breathing-organism'
      const phaseTargets = {
        'idle-mycelium':      { spore: 0.34, portal: 0.02, tunnelPull: 0.48, trailDecay: 0.91, colorHeat: 0.24, mandelReveal: 0.06, myceliumReveal: 0.78 },
        'breathing-organism': { spore: 0.78, portal: 0.58, tunnelPull: 0.72, trailDecay: 0.86, colorHeat: 0.45, mandelReveal: 0.34, myceliumReveal: 0.62 },
        'gills-portal-pull':  { spore: 0.96, portal: 0.96, tunnelPull: 1.36, trailDecay: 0.80, colorHeat: 0.56, mandelReveal: 0.72, myceliumReveal: 0.48 },
        'bloom-breakthrough': { spore: 1.12, portal: 1.28, tunnelPull: 1.04, trailDecay: 0.74, colorHeat: 0.72, mandelReveal: 1.00, myceliumReveal: 0.36 },
        'afterglow':          { spore: 0.52, portal: 0.24, tunnelPull: 0.42, trailDecay: 0.89, colorHeat: 0.28, mandelReveal: 0.32, myceliumReveal: 0.84 },
      }
      const pT = phaseTargets[phase]
      const phaseLerp = 1 - Math.exp(-dt / 1.2)
      phaseMul.spore      += (pT.spore      - phaseMul.spore)      * phaseLerp
      phaseMul.portal     += (pT.portal     - phaseMul.portal)     * phaseLerp
      phaseMul.tunnelPull += (pT.tunnelPull - phaseMul.tunnelPull) * phaseLerp
      phaseMul.trailDecay += (pT.trailDecay - phaseMul.trailDecay) * phaseLerp
      phaseMul.colorHeat  += (pT.colorHeat  - phaseMul.colorHeat)  * phaseLerp
      phaseMul.mandelReveal += (pT.mandelReveal - phaseMul.mandelReveal) * phaseLerp
      phaseMul.myceliumReveal += (pT.myceliumReveal - phaseMul.myceliumReveal) * phaseLerp
      if (import.meta.env.DEV && typeof window !== 'undefined') {
        window.__JOURNEY_PHASE__ = phase
        window.__JOURNEY_PHASE_MUL__ = { ...phaseMul }
      }

      // Stage 4 engines stay render-loop-local: existing mode IDs select five
      // smoothed internal behaviors while audio gradually wakes the system.
      const engineFluid = clamp01(1 - Math.max(visualState.modeBlend.x, visualState.modeBlend.y, visualState.modeBlend.z, visualState.modeBlend.w))
      const audioPresence = clamp01((1 - silence) * 0.58 + predictedEnergy * 0.20 + rms * 0.16 + visualState.audioBody * 0.18 + visualState.audioBrightness * 0.10)
      const journeyIntensity = clamp01(journey.value * 0.78 + journey.transient * 0.16 + audioPresence * 0.18)
      const calmMotion = clamp01((1 - journeyIntensity * 0.58) * (0.38 + silenceHold * 0.50))
      const onsetAccent = clamp01(audioPresence * (visualState.audioPulse * 0.55 + onset * 0.22 + beatPulse * 0.18))
      // bloomEnergy is uAudioBrightness's territory per role table; keep
      // audioBody/Morph as small supports only (≤0.10 each).
      const bloomEnergyRaw = clamp01((visualState.audioBody * 0.10 + visualState.audioMorph * 0.10 + visualState.audioBrightness * 0.46 + onsetAccent * 0.24) * audioPresence)
      const bloomEnergy = clamp01(bloomEnergyRaw * phaseMul.mandelReveal)
      const warpDepth = clamp01(0.16 + smoothed.chaos * 0.22 + visualState.audioMorph * 0.26 + journeyIntensity * 0.24 + calmMotion * 0.10)
      const atmosphereDensity = clamp01(0.22 + calmMotion * 0.20 + visualState.audioBrightness * 0.18 + journeyIntensity * 0.22 + smoothed.procIntensity * 0.16)
      const particleActivity = clamp01(visualState.particleEnergy * 0.72 + visualState.audioDetail * 0.22 + journeyIntensity * 0.16)
      const trailPersistence = clamp01(smoothTrailDecay * 0.62 + journeyIntensity * 0.22 + calmMotion * 0.10)
      const surfaceDetailRaw = clamp01(0.16 + smoothed.procIntensity * 0.24 + visualState.audioDetail * 0.28 + visualState.surfaceEnergy * 0.24 + audioPresence * 0.08)
      const surfaceDetail = clamp01(surfaceDetailRaw * phaseMul.myceliumReveal)
      const tunnelPull = clamp01((engineFluid * 0.56 + visualState.modeBlend.y * 0.28 + visualState.modeBlend.z * 0.16) * (0.32 + journeyIntensity * 0.42 + calmMotion * 0.18) * phaseMul.tunnelPull)
      const engineLerp = 1 - Math.exp(-dt / 0.95)
      engineATarget.set(
        engineFluid,
        clamp01(visualState.modeBlend.x),
        clamp01(visualState.modeBlend.y),
        clamp01(visualState.modeBlend.z),
      )
      engineBTarget.set(
        clamp01(visualState.modeBlend.w),
        audioPresence,
        journeyIntensity,
        calmMotion,
      )
      engineCTarget.set(
        bloomEnergy,
        warpDepth,
        atmosphereDensity,
        surfaceDetail,
      )
      engineDTarget.set(
        tunnelPull,
        trailPersistence,
        particleActivity,
        onsetAccent,
      )
      visualState.engineA.lerp(engineATarget, engineLerp)
      visualState.engineB.lerp(engineBTarget, engineLerp)
      visualState.engineC.lerp(engineCTarget, engineLerp)
      visualState.engineD.lerp(engineDTarget, engineLerp)

      // Stage 11 — tunnel / portal depth controls. All locals stay in render
      // loop; uTunnelA/B are internal-only shader uniforms (no UI / store / URL).
      // Slice D: per-mode target table for uTunnelA/B. Audio lanes clamped before use.
      const sbC  = Math.min(subBodyLane,  0.8)   // clamped sub-body
      const bpC  = Math.min(bassPunchLane, 0.6)  // clamped bass punch
      const fpC  = Math.min(fluxPulse,    0.5)   // clamped flux pulse
      const mmC  = Math.min(midMotionLane, 0.7)  // clamped mid motion

      // Per-mode targets: [inward(y), gillDepth(z), spiral(w), breathAmp(Bx), portalBloom(By)]
      // Blended through modeBlend weights (same tau as engineLerp).
      const mb = visualState.modeBlend // x=radial, y=vortex, z=collapse, w=orbit
      const mDrift   = Math.max(0, 1 - mb.x - mb.y - mb.z - mb.w)
      const mGills   = mb.x
      const mSpiral  = mb.y
      const mPulse   = mb.z
      const mOrbit   = mb.w

      const inwardTarget   = mDrift  * 0.55
                           + mGills  * 0.45
                           + mSpiral * 0.50
                           + mPulse  * Math.min(0.75 * sbC + 0.75 * (1 - sbC) * 0.55, 0.75)
                           + mOrbit  * 0.40
      const gillTarget     = mDrift  * 0.30
                           + mGills  * 0.85
                           + mSpiral * 0.45
                           + mPulse  * 0.45
                           + mOrbit  * 0.40
      const spiralTarget   = mDrift  * 0.10
                           + mGills  * 0.15
                           + mSpiral * Math.min(0.75 * mmC + 0.75 * (1 - mmC) * 0.40, 0.75)
                           + mPulse  * 0.20
                           + mOrbit  * 0.30
      const breathTarget   = mDrift  * (0.50 * sbC)
                           + mGills  * 0.40
                           + mSpiral * 0.45
                           + mPulse  * Math.min(0.80 * (sbC + bpC * 0.5), 0.80)
                           + mOrbit  * 0.40
      const portalTarget   = mDrift  * 0.20
                           + mGills  * 0.30
                           + mSpiral * 0.40
                           + mPulse  * Math.min(0.55 * fpC + 0.55 * (1 - fpC) * 0.20, 0.55)
                           + mOrbit  * 0.25

      const tunnelIdleFloor = 0.28 + calmMotion * 0.14
      const phaseDepthLift = Math.max(0, phaseMul.portal - 0.30) * 0.10 + Math.max(0, phaseMul.tunnelPull - 0.72) * 0.06
      const tunnelDepth = clamp01(tunnelIdleFloor + audioPresence * 0.45 + subBodyLane * 0.22 + journeyIntensity * 0.16 + phaseDepthLift)
      const tunnelPortalTarget = clamp01(((onsetAccent * audioPresence + bpC * audioPresence * 0.36 + fpC * audioPresence * 0.24) * phaseMul.portal + portalTarget) * 0.5)
      tunnelATarget.set(tunnelDepth, clamp01(inwardTarget), clamp01(gillTarget), clamp01(spiralTarget))
      visualState.tunnelA.lerp(tunnelATarget, engineLerp)
      const breathLerp = 1 - Math.exp(-dt / 0.40)
      visualState.tunnelB.x += (clamp01(breathTarget) - visualState.tunnelB.x) * breathLerp
      const portalAttack  = 1 - Math.exp(-dt / 0.04)
      const portalRelease = 1 - Math.exp(-dt / 0.30)
      visualState.tunnelB.y = clamp01(
        visualState.tunnelB.y +
        (tunnelPortalTarget - visualState.tunnelB.y) *
        (tunnelPortalTarget > visualState.tunnelB.y ? portalAttack : portalRelease)
      )

      const growthTrigger = clamp01((onsetAccent * 0.75 + midPulse * 0.36 + bassPulse * 0.22) * audioPresence * phaseMul.portal)
      let growthWaveReleased = false
      if (growthTrigger > 0.20 && elapsed - growthWave.lastLaunch > 0.42) {
        growthWave.age = 0
        growthWave.amp = Math.max(growthWave.amp, Math.min(1, growthTrigger * 1.12))
        growthWave.lastLaunch = elapsed
        growthWaveReleased = true
      }
      if (growthWave.amp > 0.0005) {
        growthWave.age = Math.min(1, growthWave.age + dt * (0.58 + visualState.audioMorph * 0.18 + visualState.tunnelA.y * 0.14))
        growthWave.amp *= Math.exp(-dt / (bOut.state === 'afterglow' ? 0.92 : 0.56))
      } else {
        growthWave.age = Math.min(1, growthWave.age + dt * 0.70)
        growthWave.amp = 0
      }
      visualState.tunnelB.z = growthWave.age
      visualState.tunnelB.w = growthWave.amp * phaseMul.mandelReveal
      particleMaskProxy.portalRadius = Math.max(0.14, Math.min(0.66, 0.16 + tunnelPortalTarget * 0.36 + fluxPulse * 0.10))
      particleMaskProxy.gillRingRadius = Math.max(0.34, Math.min(0.82, 0.38 + visualState.audioMorph * 0.24 + midMotionLane * 0.12 + growthWave.amp * 0.14))
      particleMaskProxy.tunnelBandRadius = Math.max(
        0.24,
        Math.min(0.84, particleMaskProxy.portalRadius * 0.36 + particleMaskProxy.gillRingRadius * 0.64),
      )

      // bass+hi spike → broad center pressure, not a localized click ripple.
      if (smoothBassHi > 0.35 && (elapsed - lastBassSpawn) > 0.4) {
        spawnAudioBreath(0, 0, Math.min(smoothBassHi * 0.18, 0.18))
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
      mainUniforms.uLowMid.value     = lowMidNL * smoothed.intensity
      mainUniforms.uMid.value        = midNL  * smoothed.intensity
      mainUniforms.uHighMid.value    = highMidNL * smoothed.intensity
      mainUniforms.uTreble.value     = trebleNL * smoothed.intensity
      mainUniforms.uHi.value         = hiNL   * smoothed.intensity
      mainUniforms.uSub.value        = subNL  * smoothed.intensity
      mainUniforms.uRms.value        = rms
      mainUniforms.uOnset.value      = onset
      mainUniforms.uBassPulse.value  = bassPulse
      mainUniforms.uMidPulse.value   = midPulse
      mainUniforms.uTreblePulse.value = treblePulse
      mainUniforms.uSilence.value    = silence
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
      mainUniforms.uEnergy.value     = clamp01(controller.energy * 0.65 + journey.value * 0.35 + journey.transient * 0.10)
      mainUniforms.uBassMid.value    = smoothBassMid
      mainUniforms.uMidHi.value      = smoothMidHi
      mainUniforms.uBassHi.value     = smoothBassHi
      mainUniforms.uCoreEnergy.value = visualState.coreEnergy
      mainUniforms.uSurfaceEnergy.value = visualState.surfaceEnergy
      mainUniforms.uParticleEnergy.value = visualState.particleEnergy
      mainUniforms.uBeatPhase.value = visualState.beatPhase
      mainUniforms.uPalettePhase.value = visualState.palettePhase
      mainUniforms.uModeBlend.value.copy(visualState.modeBlend)
      mainUniforms.uEngineA.value.copy(visualState.engineA)
      mainUniforms.uEngineB.value.copy(visualState.engineB)
      mainUniforms.uEngineC.value.copy(visualState.engineC)
      mainUniforms.uEngineD.value.copy(visualState.engineD)
      mainUniforms.uTunnelA.value.copy(visualState.tunnelA)
      mainUniforms.uTunnelB.value.copy(visualState.tunnelB)

      // Slice C: hybrid throat axis — lerp +Y toward viewer-inward as journey/mode rise.
      // The shader already declared uThroatAxis as vec3. We stay JS-side; no shader change.
      const axisBias = modeAxisBias[mode] ?? 0.15
      const axisTarget = Math.min(1, Math.max(0, journey.value * 0.5 + smoothed.intensity * 0.25 + axisBias))
      smoothThroatAxisBlend += (axisTarget - smoothThroatAxisBlend) * (1 - Math.exp(-dt / 0.9))
      // Blend +Y (cap-aligned, blend=0) toward (0,0,-1) (viewer-forward, blend=1)
      const blend = smoothThroatAxisBlend
      const axisY = Math.sqrt(Math.max(0, 1 - blend * blend))
      const axisZ = -blend
      mainUniforms.uThroatAxis.value.set(0, axisY, axisZ).normalize()

      mainUniforms.uCameraDistance.value = visualState.cameraDistance
      mainUniforms.uSpectralCentroid.value = audioData.spectralCentroid ?? 0
      mainUniforms.uSpectralFlux.value = audioData.spectralFlux ?? 0
      mainUniforms.uProcIntensity.value = smoothed.procIntensity
      mainUniforms.uAudioBody.value = visualState.audioBody
      mainUniforms.uAudioMorph.value = visualState.audioMorph
      mainUniforms.uAudioDetail.value = visualState.audioDetail
      mainUniforms.uAudioPulse.value = visualState.audioPulse
      mainUniforms.uAudioBrightness.value = visualState.audioBrightness
      mainUniforms.uAudioTurbulence.value = visualState.audioTurbulence
      // Pack direct musical lanes into vec4 uniforms — primary authority for tunnel/throat/vein
      mainUniforms.uAudioDriveA.value.set(
        visualState.laneSubBody,
        visualState.laneBassPunch,
        visualState.laneMidMotion,
        visualState.laneHighSparkle,
      )
      mainUniforms.uAudioDriveB.value.set(
        visualState.laneBrightness,
        visualState.laneFluxPulse,
        visualState.laneMotionEnergy,
        visualState.laneSilenceAmount,
      )

      // Palette family: modes 0-1 = teal/green/violet, modes 2-4 = pink/purple/violet
      const paletteFamily = mode >= 2 ? 1 : 0
      smoothPaletteFamily += (paletteFamily - smoothPaletteFamily) * (1 - Math.exp(-dt / 0.68))
      mainUniforms.uPaletteFamily.value = paletteFamily
      mainUniforms.uPaletteFamilyBlend.value = smoothPaletteFamily
      // uPaletteShift: phase heat pushes peak toward magenta/violet while
      // afterglow/idle cool by damping break heat inside the same palette family.
      const phaseHeatBias = Math.max(0, phaseMul.colorHeat - 0.45) * 0.11 * audioPresence
      const targetShift = Math.max(0, Math.min(1,
        smoothstep05(bOut.breakIntensity, 0.5, 1.0) * phaseMul.colorHeat +
        phaseHeatBias +
        (bOut.paletteDrift ?? 0) * 0.38
      ))
      mainUniforms.uPaletteShift.value  += (targetShift - mainUniforms.uPaletteShift.value) * (1 - Math.exp(-dt / 0.28))
      // Sync particle shader palette
      pMat.uniforms.uPaletteFamily.value = paletteFamily
      pMat.uniforms.uPaletteFamilyBlend.value = smoothPaletteFamily
      pMat.uniforms.uPaletteShift.value  = mainUniforms.uPaletteShift.value
      pMat.uniforms.uEnergy.value        = controller.energy
      pMat.uniforms.uParticleEnergy.value = visualState.particleEnergy
      pMat.uniforms.uBeatPhase.value      = visualState.beatPhase
      pMat.uniforms.uParticleDensity.value = Math.max(0, smoothed.particleDensity * phaseMul.spore)
      pMat.uniforms.uTreblePulse.value = treblePulse
      pMat.uniforms.uOnset.value = onset
      pMat.uniforms.uAudioBody.value = visualState.audioBody
      pMat.uniforms.uAudioDetail.value = visualState.audioDetail
      pMat.uniforms.uAudioTurbulence.value = visualState.audioTurbulence
      pMat.uniforms.uSilence.value = silence
      pMat.uniforms.uMandelPhase.value = visualState.palettePhase + centroid * 0.20 + journey.value * 0.15

      mainUniforms.uColorSpike.value = Math.max(0, mainUniforms.uColorSpike.value * 0.951)

      // Break-event distortion spike blended with collision spike (take max)
      smoothed.breakSpike += (bOut.breakIntensity - smoothed.breakSpike) * 0.10
      mainUniforms.uDistortionSpike.value = Math.max(
        Math.max(0, mainUniforms.uDistortionSpike.value * 0.919),
        smoothed.breakSpike
      )

      // Combined bass+hi boost: capped shimmer, not a click-like distortion pop.
      const combinedBoost = Math.min(0.38, bassNL * hiNL * smoothed.intensity * 0.85)
      mainUniforms.uDistortionSpike.value = Math.max(
        mainUniforms.uDistortionSpike.value,
        combinedBoost
      )

      // State-driven trail decay: Slice 6 phases own the main target; user
      // trailDecay remains a small bias and mode defaults keep subtle character.
      const modeDecayDefaults = [0.84, 0.84, 0.86, 0.90, 0.82]
      const modeDecay = modeDecayDefaults[mode] ?? 0.84
      const userDecayOffset = (smoothed.trailDecay - 0.84) * 0.35
      const modeDecayOffset = (modeDecay - 0.84) * 0.15
      const baseDecay = Math.max(0.70, Math.min(0.94, phaseMul.trailDecay + userDecayOffset + modeDecayOffset))
      const minDecay = Math.max(0.68, baseDecay - 0.06)
      const transitionClear = (1 - modeTransition) * 0.14
      const bassClear = mainUniforms.uBass.value * 0.035 * (1 - smoothstep05(journey.value, 0.45, 0.80) * 0.20)
      const growthClear = growthWave.amp * 0.028
      // silenceAmount is the smoothed lane; same shape as raw silence but
      // already EMA'd. Use it so quiet stretches don't strobe the trail.
      const silenceHold01 = silenceAmount * 0.025
      // Effective trail decay biases: high motion + flux pulses reduce
      // persistence so heavy passages don't smear into solid color. Bumped
      // from 0.018 / 0.020 → 0.060 / 0.080 (fluxPulse clamped at 0.5 so a
      // single onset can't yank decay below the floor) per the fungal-portal
      // rework brief: trail must clear under bass/onset, gently hold under
      // silence, and respect the user's trailDecay slider as ceiling via
      // baseDecay above.
      const motionDecayBias = motionEnergy * 0.060
      const fluxDecayBias = Math.min(fluxPulse, 0.5) * 0.080
      const targetDecay = Math.max(0.68, Math.min(0.94, Math.max(minDecay, baseDecay - bassClear - growthClear - transitionClear - motionDecayBias - fluxDecayBias + silenceHold01)))
      const trailTau = transitionClear > 0.01 ? 0.11 : 0.24
      smoothTrailDecay += (targetDecay - smoothTrailDecay) * (1 - Math.exp(-dt / trailTau))
      trailUniforms.uDecay.value = smoothTrailDecay
      trailUniforms.uEnergy.value = visualState.particleEnergy
      trailUniforms.uBeatPhase.value = visualState.beatPhase
      trailUniforms.uFlow.value = Math.min(1, lowMidNL * 0.32 + midNL * 0.28 + bassPulse * 0.20 + visualState.surfaceEnergy * 0.35 + journey.value * 0.20)
      trailUniforms.uOnset.value = onset
      trailUniforms.uTreble.value = Math.min(1, trebleNL)
      trailUniforms.uAudioDetail.value = visualState.audioDetail
      trailUniforms.uAudioTurbulence.value = visualState.audioTurbulence
      trailUniforms.uTreblePulse.value = treblePulse

      if (pendingTrailClearFrames > 0) {
        trailUniforms.uCurrent.value = null
        trailUniforms.uPrev.value = null
        finalUniforms.uCurrent.value = null
        renderer.setRenderTarget(trailRead)
        renderer.clear()
        renderer.setRenderTarget(trailWrite)
        renderer.clear()
        pendingTrailClearFrames--
      }

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
      const hiVal = Math.min(1, (visualState.particleEnergy * 0.72 + highSparkleLane * 0.28) * smoothed.intensity)
      const density = Math.max(0, smoothed.particleDensity)
      const livingGate = (1 - silence * 0.42) * idleMotionGate
      const livingParticles = countLivingParticles()
      const crowding = livingParticles / MAX_PARTICLES
      const capacityGate = 1 - smoothstep05(crowding, 0.58, 0.92)
      const transitionSpawnGate = 0.62 + modeTransition * 0.38
      const calmSpawnGate = bOut.state === 'calm' ? 0.62 : 1
      const journeyGate = 0.55 + journey.value * 0.55
      // Slice G: silenceCalm gates spawn density (extends from color-only to count)
      const silenceCalm = 1 - silenceAmount * 0.35
      // motionEnergy boosts spawn rate; silenceAmount gates down further
      const motionEnergyLane = visualState.laneMotionEnergy
      const spawnRate = hiVal * (1.15 + beatConfidence * 1.35 + visualState.audioDetail * 0.70 + motionEnergyLane * 0.50) * density * livingGate * capacityGate * transitionSpawnGate * calmSpawnGate * journeyGate * phaseMul.spore * silenceCalm
      const particleThreshold = 0.13 + silenceHold * 0.06 + crowding * 0.08
      if (density > 0.03 && growthWaveReleased && capacityGate > 0.14 && livingParticles < MAX_PARTICLES * 0.82) {
        const growthCount = bOut.state === 'peak' ? 6 : bOut.state === 'build' ? 5 : 3
        spawnGrowthWaveSpores(growthCount, growthWave.amp, mode, silence)
      }
      if (density > 0.01 && hiVal > lastHi * 0.95 && hiVal > particleThreshold && livingGate > 0.22 && capacityGate > 0.04) {
        const wholeSpawns = Math.floor(spawnRate)
        const maxFrameSpawns = bOut.state === 'peak' && density > 1.15 && crowding < 0.55 ? 2 : 1
        const spawns = Math.min(maxFrameSpawns, wholeSpawns + (Math.random() < spawnRate - wholeSpawns ? 1 : 0))
        for (let s = 0; s < spawns; s++) {
          const spawnMode = Math.random() < modeTransition ? mode : particleBlendFromMode
          spawnParticleForMode(spawnMode, hiVal, null, silence)
        }
      }

      // Sustained audio keeps a tiny living ecosystem present between treble edges.
      const sustainedSporeChance = dt *
        Math.min(1.20, 0.14 + visualState.particleEnergy * 0.52 + journey.value * 0.32 + visualState.audioDetail * 0.20 + highSparkleLane * 0.22) *
        density * capacityGate * transitionSpawnGate * phaseMul.spore * (1 - silence * 0.78)
      if (density > 0.04 && crowding < 0.58 && capacityGate > 0.18 && Math.random() < sustainedSporeChance) {
        const spawnMode = Math.random() < modeTransition ? mode : particleBlendFromMode
        spawnParticleForMode(spawnMode, hiVal, null, silence)
      }
      const tunnelSporeChance = dt *
        Math.min(0.86, 0.06 + visualState.audioMorph * 0.22 + midMotionLane * 0.18 + tunnelPull * 0.30 + growthWave.amp * 0.36) *
        density * capacityGate * transitionSpawnGate * phaseMul.spore * (1 - silence * 0.70)
      if (density > 0.04 && bOut.state !== 'calm' && crowding < 0.70 && capacityGate > 0.12 && Math.random() < tunnelSporeChance) {
        spawnAnnulusSpore(
          particleMaskProxy.tunnelBandRadius,
          hiVal + growthWave.amp * 0.25,
          particleDepth('mid', visualState.audioMorph),
          silence,
          'tunnel',
        )
      }
      const fractalSporeChance = dt *
        Math.min(0.68, 0.04 + highSparkleLane * 0.30 + visualState.audioPulse * 0.16 + fluxPulse * 0.18 + tunnelPortalTarget * 0.26) *
        density * capacityGate * transitionSpawnGate * (1 - silence * 0.76)
      if (density > 0.04 && crowding < 0.72 && capacityGate > 0.12 && Math.random() < fractalSporeChance) {
        spawnAnnulusSpore(
          particleMaskProxy.portalRadius,
          hiVal + visualState.audioDetail * 0.18,
          particleDepth('near', visualState.audioDetail),
          silence,
          'portal',
        )
      }
      lastHi = hiVal

      // Ambient idle dust stays sparse so silence breathes without filling the blob.
      if (density > 0.05 && bOut.state === 'calm' && crowding < 0.42 && Math.random() < dt * Math.min(0.42, 0.10 + density * 0.28) * (0.45 + livingGate * 0.35) * idleMotionGate * phaseMul.spore) {
        const d = particleDepth('far', visualState.audioDetail)
        const idleDustVelocity = (0.00016 + livingGate * 0.00034) * depthScale(d)
        spawnParticle(
          Math.random() * 2 - 1, Math.random() * 2 - 1,
          (Math.random() - 0.5) * idleDustVelocity, (Math.random() - 0.5) * idleDustVelocity,
          3.6 + Math.random() * 2.4, 0, d)
      }
      const shimmerMoteChance = dt *
        Math.min(0.70, visualState.audioDetail * 0.24 + highSparkleLane * 0.34 + treblePulse * 0.18 + growthWave.amp * 0.20) *
        density * capacityGate * (1 - silence * 0.82)
      if (density > 0.05 && crowding < 0.74 && capacityGate > 0.10 && Math.random() < shimmerMoteChance) {
        const angle = Math.random() * Math.PI * 2
        const d = particleDepth('near', visualState.audioDetail)
        const parallax = depthScale(d)
        const r = randRange(0.24, 0.58)
        const spd = randRange(0.0007, 0.0022) * parallax * (0.45 + visualState.audioDetail)
        spawnParticle(
          Math.cos(angle) * r,
          Math.sin(angle) * r,
          -Math.sin(angle) * spd + (Math.random() - 0.5) * 0.0007,
          Math.cos(angle) * spd + (Math.random() - 0.5) * 0.0007,
          randRange(0.75, 1.45),
          1,
          d,
        )
      }

      // Blob-collision burst: restrained near-surface embers, not an explosion.
      if (blobBurstPending > 0) {
        const burstCapacity = Math.max(0, Math.floor(MAX_PARTICLES * 0.66) - countLivingParticles())
        const count = Math.min(blobBurstPending, Math.max(0, Math.min(5, burstCapacity)))
        blobBurstPending = 0
        for (let s = 0; s < count; s++) {
          const angle = Math.random() * Math.PI * 2
          const d = particleDepth('near', visualState.audioPulse)
          const parallax = depthScale(d)
          const r = randRange(0.30, 0.43)
          const spd = randRange(0.0018, 0.0037) * parallax * (1 - silence * 0.55)
          spawnParticle(
            Math.cos(angle) * r, Math.sin(angle) * r,
            Math.cos(angle) * spd, Math.sin(angle) * spd,
            1.0 + Math.random() * 0.9, 1, d)
        }
      }

      // Update live particles: depth-aware ecosystem currents + force coupling.
      for (let i = 0; i < MAX_PARTICLES; i++) {
        if (ages[i] < lives[i]) {
          ages[i] += dt
          const ageNorm = Math.min(1, ages[i] / Math.max(lives[i], 0.001))
          const type = ptypes[i]
          const pDepth = clamp01(pdepths[i])
          const parallax = depthScale(pDepth)
          const farWeight = 1 - smoothstep05(pDepth, 0.34, 0.62)
          const nearWeight = smoothstep05(pDepth, 0.68, 0.92)
          const midWeight = Math.max(0, 1 - farWeight - nearWeight * 0.55)
          const modeRadial = visualState.modeBlend.x
          const modeVortex = visualState.modeBlend.y
          const modeCollapse = visualState.modeBlend.z
          const modeOrbit = visualState.modeBlend.w
          const accelGate = clamp01((1 - silence * 0.86) * idleMotionGate)
          const shimmerGate = clamp01(accelGate * (0.32 + nearWeight * 0.68))
          const drag = 0.986 + farWeight * 0.009 + midWeight * 0.005 - modeCollapse * 0.003 - nearWeight * 0.002
          velocities[i].x *= drag
          velocities[i].y *= drag
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
            const forceLift = (0.28 + parallax * 0.72) * (0.18 + accelGate * 0.82)
            velocities[i].x += falloff * sign * (dx / d) * Math.abs(f.strength) * (1 - f.age) * 0.00018 * forceLift
            velocities[i].y += falloff * sign * (dy / d) * Math.abs(f.strength) * (1 - f.age) * 0.00018 * forceLift
          }
          // Curl noise: divergence-free field adds drift that matches the blob's flow
          const curlScale = 1.55 + modeRadial * 0.35 + modeVortex * 0.55 + modeOrbit * 0.30
          const curl = curlNoise(px * curlScale + pDepth * 1.7, py * curlScale - pDepth * 1.3, elapsed + type * 7.0)
          const curlStrength = 0.000045 * (0.18 + accelGate * 0.82) * (farWeight * 0.40 + midWeight * 1.05 + nearWeight * 0.78) * (1 + visualState.audioMorph * 1.7 + visualState.audioTurbulence * 1.1 + smoothMidHi * 1.05)
          velocities[i].x += curl.x * curlStrength
          velocities[i].y += curl.y * curlStrength
          const d = Math.sqrt(px * px + py * py) || 1
          const tangentX = -py / d
          const tangentY = px / d
          const radialX = px / d
          const radialY = py / d
          const slowCurrent = (0.000010 + calmMotion * 0.000018) * (farWeight * 1.25 + midWeight * 0.45) * (1 - nearWeight * 0.35)
          velocities[i].x += curl.x * slowCurrent
          velocities[i].y += (curl.y + 0.16) * slowCurrent
          // Clamp the per-frame radialKick so coincident bass + onset can't
          // compound into a screen-tap pop; silenceAmount cleanly stills the kick.
          const radialKickRaw = (bassPunchLane * 0.000064 + fluxPulse * 0.000030 + visualState.audioPulse * 0.000036) * shimmerGate * (0.52 + parallax * 0.48)
          const radialKick = Math.min(radialKickRaw, 0.00012) * (1 - silenceAmount * 0.85)
          if (radialKick > 0.0) {
            const collapseSign = modeCollapse > 0.45 && type > 1.5 ? -0.65 : 1
            velocities[i].x += radialX * radialKick * collapseSign
            velocities[i].y += radialY * radialKick * collapseSign
          }
          const vortexDrift = modeVortex * (0.000050 + visualState.audioMorph * 0.000095 + visualState.audioTurbulence * 0.000035) * shimmerGate * (midWeight + nearWeight * 0.75)
          const vortexTighten = modeVortex * (0.000025 + visualState.audioMorph * 0.000050) * shimmerGate * (midWeight + nearWeight * 0.80)
          const orbitLock = modeOrbit * (0.000035 + visualState.audioDetail * 0.000065) * (1 - ageNorm * 0.45) * shimmerGate * (farWeight * 0.45 + midWeight * 0.80 + nearWeight * 0.55)
          const radialBreath = modeRadial * Math.sin(elapsed * 1.4 + pDepth * 6.0) * 0.000050 * (0.22 + accelGate * 0.78) * (farWeight * 0.50 + midWeight + nearWeight * 0.55)
          const collapsePull = modeCollapse * (0.000070 + visualState.audioBody * 0.000125) * (type > 1.5 ? 1.20 : 0.70) * (0.15 + accelGate * 0.85)
          const fluidTide = (1 - Math.max(modeRadial, modeVortex, modeCollapse, modeOrbit)) * Math.sin(elapsed * 0.55 + pDepth * 8.0) * 0.000024 * (farWeight + midWeight * 0.45) * (0.35 + calmMotion * 0.65)
          velocities[i].x += tangentX * (vortexDrift + orbitLock + fluidTide) + radialX * radialBreath - radialX * (collapsePull + vortexTighten)
          velocities[i].y += tangentY * (vortexDrift + orbitLock + fluidTide) + radialY * radialBreath - radialY * (collapsePull + vortexTighten)
          const speedLimit = 0.0014 + nearWeight * 0.0020 + shimmerGate * 0.0014 + midWeight * 0.0007
          const speed = Math.sqrt(velocities[i].x * velocities[i].x + velocities[i].y * velocities[i].y)
          if (speed > speedLimit) {
            const slow = speedLimit / speed
            velocities[i].x *= slow
            velocities[i].y *= slow
          }

          positions[i * 3]     += velocities[i].x
          positions[i * 3 + 1] += velocities[i].y
          const edge = Math.max(Math.abs(positions[i * 3]), Math.abs(positions[i * 3 + 1]))
          if (edge > 1.18) {
            positions[i * 3] *= 0.985
            positions[i * 3 + 1] *= 0.985
            velocities[i].x *= -0.15
            velocities[i].y *= -0.15
          }
        }
      }
      pGeo.attributes.position.needsUpdate = true
      pGeo.attributes.aAge.needsUpdate     = true
      pGeo.attributes.aLife.needsUpdate    = true
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
            spawnGestureForce(Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0.7)
          }, i * 60))
          controller.injectEnergy(0.12)
        }

        if (!discoveries.includes('figure8') && detectFigure8(nowMs)) {
          addDiscovery('figure8')
          // Palette shift spike
          mainUniforms.uColorSpike.value = Math.min(1.0, mainUniforms.uColorSpike.value + 1.0)
          mainUniforms.uPaletteShift.value = Math.min(1.0, mainUniforms.uPaletteShift.value + 0.8)
          spawnGestureForce(0, 0, 0.9)
          controller.injectEnergy(0.15)
        }

        if (!discoveries.includes('rapidClick') && detectRapidClick(nowMs)) {
          addDiscovery('rapidClick')
          // Single soft growth bloom at center + small color spike. Replaces
          // the prior 5-pulse 40ms storm that read as glitchy strobe.
          spawnGestureForce(0, 0, 0.45)
          mainUniforms.uColorSpike.value = Math.min(1.0, mainUniforms.uColorSpike.value + 0.35)
          mainUniforms.uDistortionSpike.value = Math.min(0.4, mainUniforms.uDistortionSpike.value + 0.4)
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
      canvasRef.current?.removeEventListener('pointermove', onPointerMove)
      canvasRef.current?.removeEventListener('pointerdown', onPointerDown)
      canvasRef.current?.removeEventListener('pointerup', onPointerUp)
      canvasRef.current?.removeEventListener('pointercancel', onPointerUp)
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
