import * as THREE from 'three'

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  return renderer
}

export function resizeRenderer(renderer, renderTargets) {
  const w = window.innerWidth
  const h = window.innerHeight
  renderer.setSize(w, h)
  if (renderTargets) {
    renderTargets.forEach((rt) => rt.setSize(w, h))
  }
}
