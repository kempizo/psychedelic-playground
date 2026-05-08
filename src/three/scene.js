import * as THREE from 'three'

export function createScene() {
  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  return { scene, camera }
}
