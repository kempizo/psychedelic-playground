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
      uPulses:          { value: [
        new THREE.Vector4(0,0,0,0), new THREE.Vector4(0,0,0,0),
        new THREE.Vector4(0,0,0,0), new THREE.Vector4(0,0,0,0),
        new THREE.Vector4(0,0,0,0), new THREE.Vector4(0,0,0,0),
        new THREE.Vector4(0,0,0,0), new THREE.Vector4(0,0,0,0),
      ]},
      uColorSpike:      { value: 0 },
      uDistortionSpike: { value: 0 },
      uMouseDir:        { value: new THREE.Vector2(0, 0) },
      uPulseExtra: { value: [
        new THREE.Vector4(0,0,0,0), new THREE.Vector4(0,0,0,0),
        new THREE.Vector4(0,0,0,0), new THREE.Vector4(0,0,0,0),
        new THREE.Vector4(0,0,0,0), new THREE.Vector4(0,0,0,0),
        new THREE.Vector4(0,0,0,0), new THREE.Vector4(0,0,0,0),
      ]},
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
    const positions = new Float32Array(MAX_PARTICLES * 3)
    const ages      = new Float32Array(MAX_PARTICLES)
    const lives     = new Float32Array(MAX_PARTICLES)
    const velocities = Array.from({ length: MAX_PARTICLES }, () => ({ x: 0, y: 0 }))

    // Init all particles as dead
    lives.fill(1)
    ages.fill(999)

    const pGeo = new THREE.BufferGeometry()
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    pGeo.setAttribute('aAge', new THREE.BufferAttribute(ages, 1))
    pGeo.setAttribute('aLife', new THREE.BufferAttribute(lives, 1))

    const pMat = new THREE.ShaderMaterial({
      vertexShader: particleVert,
      fragmentShader: particleFrag,
      uniforms: { uPixelRatio: { value: renderer.getPixelRatio() } },
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
    const mouseDirSmooth = new THREE.Vector2(0, 0)
    let mouseVel = 0
    let cursorHideTimer = null

    const onMouseMove = (e) => {
      rawMouse.x =  (e.clientX / window.innerWidth)  * 2 - 1
      rawMouse.y = -((e.clientY / window.innerHeight) * 2 - 1)
      clearTimeout(cursorHideTimer)
      if (canvasRef.current) canvasRef.current.style.cursor = ''
      cursorHideTimer = setTimeout(() => {
        if (!isHolding && canvasRef.current) canvasRef.current.style.cursor = 'none'
      }, 3000)
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
    const clock      = new THREE.Clock()
    const controller = new BehavioralController()

    // ── Pulse manager (render-loop-local, not in Zustand) ─────────────────────
    const MAX_PULSES = 8
    const pulses = Array.from({ length: MAX_PULSES }, () => ({
      origin: new THREE.Vector2(0, 0),
      energy: 0,
      speed: 0,
      radius: 0,
      type: 'click',
      generation: 0,
      alive: false,
      collidedWith: new Set(),
      birthTime: 0,
      dirX: 0,
      dirY: 0,
      typeIndex: 0,
    }))
    let lastElapsed = 0

    const spawnPulse = (x, y, energy, speed, type, generation = 0) => {
      let slot = -1
      for (let i = 0; i < MAX_PULSES; i++) {
        if (!pulses[i].alive) { slot = i; break }
      }
      if (slot === -1) {
        let minGen = 999, oldestBirth = Infinity
        for (let i = 0; i < MAX_PULSES; i++) {
          const p = pulses[i]
          if (p.generation < minGen ||
              (p.generation === minGen && p.birthTime < oldestBirth)) {
            minGen = p.generation
            oldestBirth = p.birthTime
            slot = i
          }
        }
      }
      const p = pulses[slot]
      p.origin.set(x, y)
      p.energy = energy
      p.speed = speed
      p.radius = 0
      p.type = type
      p.generation = generation
      p.alive = true
      p.collidedWith = new Set()
      p.birthTime = clock.getElapsedTime()
      p.dirX = mouseDirSmooth.x
      p.dirY = mouseDirSmooth.y
      p.typeIndex = type === 'click' ? 0 : type === 'bass' ? 1 : type === 'hold' ? 2 : 3
    }

    const spawnParticle = (px, py, vx, vy, life) => {
      for (let i = 0; i < MAX_PARTICLES; i++) {
        if (ages[i] < lives[i]) continue
        positions[i * 3]     = px
        positions[i * 3 + 1] = py
        positions[i * 3 + 2] = 0
        ages[i]  = 0
        lives[i] = life
        // Nearest active pulse ring within 0.15 NDC boosts velocity outward
        for (let k = 0; k < MAX_PULSES; k++) {
          const pk = pulses[k]
          if (!pk.alive) continue
          const dx = px - pk.origin.x, dy = py - pk.origin.y
          const d  = Math.sqrt(dx * dx + dy * dy)
          if (Math.abs(d - pk.radius) < 0.15) {
            const n = d || 1
            vx += (dx / n) * pk.energy * 0.006
            vy += (dy / n) * pk.energy * 0.006
            break
          }
        }
        velocities[i].x = vx
        velocities[i].y = vy
        break
      }
    }

    const onMouseDown = (e) => {
      const x = (e.clientX / window.innerWidth)  * 2 - 1
      const y = -((e.clientY / window.innerHeight) * 2 - 1)
      spawnPulse(x, y, 0.85, 0.7, 'click', 0)
      isHolding = true
      holdStartTime = clock.getElapsedTime()
      lastHoldSpawn = holdStartTime
      canvasRef.current.style.cursor = 'none'
    }
    const onMouseUp = () => {
      isHolding = false
      canvasRef.current.style.cursor = ''
    }
    canvasRef.current.addEventListener('mousedown', onMouseDown)
    canvasRef.current.addEventListener('mouseup', onMouseUp)

    // Smoothed control values — lerped toward behavioral targets each frame.
    const { speed: s0, intensity: i0, colorShift: c0, chaos: ch0 } = useStore.getState()
    const smoothed = { speed: s0, intensity: i0, colorShift: c0, chaos: ch0, breakSpike: 0 }
    const LERP = 0.05

    let prevSpeed = s0, prevIntensity = i0, prevColorShift = c0, prevChaos = ch0

    const tick = () => {
      rafId = requestAnimationFrame(tick)
      const elapsed = clock.getElapsedTime()
      const dt = elapsed - lastElapsed
      lastElapsed = elapsed

      for (let i = 0; i < MAX_PULSES; i++) {
        const p = pulses[i]
        if (!p.alive) continue
        p.radius += p.speed * dt
        p.speed   = Math.max(p.speed * 0.994, 0.12)
        p.energy *= p.generation >= 3 ? 0.958 : 0.979
        if (p.energy < 0.01 || p.radius > 2.5) p.alive = false
      }

      // Pulse-pulse collision detection (28 unique pairs max)
      for (let i = 0; i < MAX_PULSES; i++) {
        const pi = pulses[i]
        if (!pi.alive) continue
        for (let j = i + 1; j < MAX_PULSES; j++) {
          const pj = pulses[j]
          if (!pj.alive) continue
          if (pi.collidedWith.has(j) || pj.collidedWith.has(i)) continue
          const sep = pi.origin.distanceTo(pj.origin)
          if (Math.abs(pi.radius + pj.radius - sep) < 0.08) {
            pi.collidedWith.add(j)
            pj.collidedWith.add(i)
            const chainEnergy = (pi.energy + pj.energy) * 0.5 * 0.65
            const chainGen    = Math.max(pi.generation, pj.generation) + 1
            if (chainEnergy > 0.15 && chainGen <= 3) {
              const mx = (pi.origin.x + pj.origin.x) * 0.5
              const my = (pi.origin.y + pj.origin.y) * 0.5
              spawnPulse(mx, my, chainEnergy, (pi.speed + pj.speed) * 0.5 * 0.9, 'chain', chainGen)
            }
            mainUniforms.uColorSpike.value      = Math.min(1.0, mainUniforms.uColorSpike.value      + 0.4)
            mainUniforms.uDistortionSpike.value = Math.min(1.0, mainUniforms.uDistortionSpike.value + 0.5)
          }
        }
      }

      // Pulse-blob collision detection (blob ≈ sphere at origin, NDC radius 0.35)
      for (let i = 0; i < MAX_PULSES; i++) {
        const pi = pulses[i]
        if (!pi.alive || pi.collidedWith.has(-1)) continue
        const sep = Math.sqrt(pi.origin.x * pi.origin.x + pi.origin.y * pi.origin.y)
        if (Math.abs(pi.radius - 0.35) < 0.12 && sep < 0.5) {
          pi.collidedWith.add(-1)
          blobBurstPending += 8 + Math.floor(Math.random() * 5)
          mainUniforms.uColorSpike.value      = Math.min(1.0, mainUniforms.uColorSpike.value      + 0.3)
          mainUniforms.uDistortionSpike.value = Math.min(1.0, mainUniforms.uDistortionSpike.value + 0.6)
        }
      }

      const store = useStore.getState()
      const { audioData, speed, intensity, colorShift, chaos, mode } = store

      // Detect slider changes to reset auto-blend idle timer
      const anyChanged = Math.abs(speed      - prevSpeed)      > 0.005 ||
                         Math.abs(intensity  - prevIntensity)  > 0.005 ||
                         Math.abs(colorShift - prevColorShift) > 0.005 ||
                         Math.abs(chaos      - prevChaos)      > 0.005
      if (anyChanged) controller.userIdleTimer = 0
      prevSpeed = speed; prevIntensity = intensity
      prevColorShift = colorShift; prevChaos = chaos

      // Behavioral controller: blends user controls with state-machine targets
      const bOut = controller.tick(audioData, dt, { speed, intensity, colorShift, chaos })

      smoothed.speed      += (bOut.speed      - smoothed.speed)      * LERP
      smoothed.intensity  += (bOut.intensity  - smoothed.intensity)  * LERP
      smoothed.colorShift += (bOut.colorShift - smoothed.colorShift) * LERP
      smoothed.chaos      += (bOut.chaos      - smoothed.chaos)      * LERP

      // Bass auto-spawn: rising edge with 0.3s cooldown
      const curBass = audioData.bass
      if (curBass > lastBass * 1.3 && curBass > 0.35 && (elapsed - lastBassSpawn) > 0.3) {
        const energy = Math.min(curBass * smoothed.intensity, 0.9)
        const spd    = 0.6 + curBass * 0.4
        const jx = (Math.random() - 0.5) * 0.1 + mouseDirSmooth.x * 0.08
        const jy = (Math.random() - 0.5) * 0.1 + mouseDirSmooth.y * 0.08
        spawnPulse(jx, jy, energy, spd, 'bass', 0)
        lastBassSpawn = elapsed
      }
      lastBass = curBass

      // Hold injection: emit every 250ms after 150ms threshold
      if (isHolding && (elapsed - holdStartTime) > 0.15 && (elapsed - lastHoldSpawn) > 0.25) {
        spawnPulse(rawMouse.x, rawMouse.y, 0.45, 0.7, 'hold', 0)
        lastHoldSpawn = elapsed
      }

      // Auto-mode: virtual pulses from behavioral controller
      if (bOut.virtualPulse) {
        const vp = bOut.virtualPulse
        spawnPulse(vp.x, vp.y, vp.energy, vp.speed, vp.type, 0)
      }

      // Mouse velocity: accumulate movement, decay 0.92/frame
      const mouseDelta = rawMouse.distanceTo(prevRawMouse)
      mouseVel = Math.min(mouseVel + mouseDelta, 1.0) * 0.92
      // Smoothed direction: only update when mouse is actually moving
      if (mouseDelta > 0.0001) {
        const dl = mouseDelta
        mouseDirSmooth.x += ((rawMouse.x - prevRawMouse.x) / dl - mouseDirSmooth.x) * 0.1
        mouseDirSmooth.y += ((rawMouse.y - prevRawMouse.y) / dl - mouseDirSmooth.y) * 0.1
        const sl = Math.sqrt(mouseDirSmooth.x * mouseDirSmooth.x + mouseDirSmooth.y * mouseDirSmooth.y) || 1
        mouseDirSmooth.x /= sl
        mouseDirSmooth.y /= sl
      }
      prevRawMouse.copy(rawMouse)
      smoothedMouse.x += (rawMouse.x - smoothedMouse.x) * 0.04
      smoothedMouse.y += (rawMouse.y - smoothedMouse.y) * 0.04
      const aspect = window.innerWidth / window.innerHeight

      // Update main uniforms
      mainUniforms.uTime.value       = elapsed
      mainUniforms.uBass.value       = audioData.bass * smoothed.intensity
      mainUniforms.uMid.value        = audioData.mid  * smoothed.intensity
      mainUniforms.uHi.value         = audioData.hi   * smoothed.intensity
      mainUniforms.uSub.value        = audioData.sub  * smoothed.intensity
      mainUniforms.uSpeed.value      = smoothed.speed
      mainUniforms.uIntensity.value  = smoothed.intensity
      mainUniforms.uColorShift.value = smoothed.colorShift
      mainUniforms.uChaos.value      = smoothed.chaos
      mainUniforms.uMode.value       = mode
      mainUniforms.uMouse.value.set(smoothedMouse.x * aspect, smoothedMouse.y)
      mainUniforms.uMouseVel.value   = mouseVel
      mainUniforms.uMouseDir.value.set(mouseDirSmooth.x, mouseDirSmooth.y)
      for (let i = 0; i < MAX_PULSES; i++) {
        const p = pulses[i]
        if (p.alive) {
          mainUniforms.uPulses.value[i].set(p.origin.x, p.origin.y, p.radius, p.energy)
          mainUniforms.uPulseExtra.value[i].set(p.dirX, p.dirY, p.birthTime, p.typeIndex)
        } else {
          mainUniforms.uPulses.value[i].set(0, 0, 0, 0)
          mainUniforms.uPulseExtra.value[i].set(0, 0, 0, 0)
        }
      }
      mainUniforms.uColorSpike.value = Math.max(0, mainUniforms.uColorSpike.value * 0.951)

      // Break-event distortion spike blended with collision spike (take max)
      smoothed.breakSpike += (bOut.breakIntensity - smoothed.breakSpike) * 0.10
      mainUniforms.uDistortionSpike.value = Math.max(
        Math.max(0, mainUniforms.uDistortionSpike.value * 0.919),
        smoothed.breakSpike
      )

      // State-driven trail decay (behavioral) + mode + bass modulation
      const baseDecay = bOut.trailDecay ?? (mode === 1 ? 0.88 : 0.84)
      const minDecay  = baseDecay - 0.04
      trailUniforms.uDecay.value = Math.max(minDecay, baseDecay - mainUniforms.uBass.value * 0.04)

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

      // Particle spawn on treble
      const hiVal = audioData.hi * smoothed.intensity
      const spawnRate = hiVal * 4
      if (hiVal > lastHi * 0.85 && hiVal > 0.15) {
        const spawns = Math.floor(spawnRate)
        for (let s = 0; s < spawns; s++) {
          spawnParticle(
            Math.random() * 2 - 1,
            Math.random() * 2 - 1,
            (Math.random() - 0.5) * 0.004,
            (Math.random() - 0.5) * 0.004 + 0.001,
            1.5 + Math.random() * 1.5,
          )
        }
      }
      lastHi = hiVal

      // Blob-collision burst: particles ejected radially from blob surface
      if (blobBurstPending > 0) {
        const count = blobBurstPending
        blobBurstPending = 0
        for (let s = 0; s < count; s++) {
          const angle = Math.random() * Math.PI * 2
          const r     = 0.30 + Math.random() * 0.10
          const spd   = 0.005 + Math.random() * 0.005
          spawnParticle(
            Math.cos(angle) * r,
            Math.sin(angle) * r,
            Math.cos(angle) * spd,
            Math.sin(angle) * spd,
            1.0 + Math.random() * 1.0,
          )
        }
      }

      // Update live particles (fixed timestep)
      for (let i = 0; i < MAX_PARTICLES; i++) {
        if (ages[i] < lives[i]) {
          ages[i] += 1 / 60
          velocities[i].x *= 0.997
          velocities[i].y *= 0.997
          positions[i * 3]     += velocities[i].x
          positions[i * 3 + 1] += velocities[i].y
        }
      }
      pGeo.attributes.position.needsUpdate = true
      pGeo.attributes.aAge.needsUpdate     = true

      renderer.autoClear = false
      renderer.render(particleScene, particleCamera)
      renderer.autoClear = true

      // Ping-pong swap: trailWrite becomes trailRead next frame
      const tmp = trailRead; trailRead = trailWrite; trailWrite = tmp
    }

    rafId = requestAnimationFrame(tick)

    cleanupRef.current = () => {
      cancelAnimationFrame(rafId)
      clearTimeout(cursorHideTimer)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('mousemove', onMouseMove)
      canvasRef.current?.removeEventListener('mousedown', onMouseDown)
      canvasRef.current?.removeEventListener('mouseup', onMouseUp)
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
