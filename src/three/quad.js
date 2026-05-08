import * as THREE from 'three'

export function createQuad(material) {
  const geo = new THREE.PlaneGeometry(2, 2)
  const mesh = new THREE.Mesh(geo, material)
  return mesh
}
