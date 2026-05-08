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

    // ── Render loop ───────────────────────────────────────────────────────────
    let rafId
    // rtA = fresh main shader output each frame
    // trailRead / trailWrite ping-pong between rtB and rtC so Pass 2 never
    // reads and writes the same target (WebGL feedback loop).
    let trailRead  = rtB
    let trailWrite = rtC
    let lastHi = 0
    const clock = new THREE.Clock()

    const tick = () => {
      rafId = requestAnimationFrame(tick)
      const elapsed = clock.getElapsedTime()
      const store = useStore.getState()
      const { audioData, speed, intensity, colorShift, chaos, mode } = store

      // Update main uniforms
      mainUniforms.uTime.value       = elapsed
      mainUniforms.uBass.value       = audioData.bass * intensity
      mainUniforms.uMid.value        = audioData.mid  * intensity
      mainUniforms.uHi.value         = audioData.hi   * intensity
      mainUniforms.uSub.value        = audioData.sub  * intensity
      mainUniforms.uSpeed.value      = speed
      mainUniforms.uIntensity.value  = intensity
      mainUniforms.uColorShift.value = colorShift
      mainUniforms.uChaos.value      = chaos
      mainUniforms.uMode.value       = mode

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
      const hiVal = audioData.hi * intensity
      const spawnRate = hiVal * 4
      if (hiVal > lastHi * 0.85 && hiVal > 0.15) {
        const spawns = Math.floor(spawnRate)
        for (let s = 0; s < spawns; s++) {
          // Find a dead particle
          for (let i = 0; i < MAX_PARTICLES; i++) {
            if (ages[i] >= lives[i]) {
              positions[i * 3]     = Math.random() * 2 - 1
              positions[i * 3 + 1] = Math.random() * 2 - 1
              positions[i * 3 + 2] = 0
              ages[i]  = 0
              lives[i] = 1.5 + Math.random() * 1.5
              velocities[i].x = (Math.random() - 0.5) * 0.004
              velocities[i].y = (Math.random() - 0.5) * 0.004 + 0.001
              break
            }
          }
        }
      }
      lastHi = hiVal

      // Update live particles (fixed timestep)
      for (let i = 0; i < MAX_PARTICLES; i++) {
        if (ages[i] < lives[i]) {
          ages[i] += 1 / 60
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
      window.removeEventListener('resize', onResize)
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
