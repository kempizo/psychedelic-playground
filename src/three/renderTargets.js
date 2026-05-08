import * as THREE from 'three'

export function createPingPongTargets() {
  const opts = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
  }
  const w = window.innerWidth
  const h = window.innerHeight
  return [
    new THREE.WebGLRenderTarget(w, h, opts),
    new THREE.WebGLRenderTarget(w, h, opts),
  ]
}
