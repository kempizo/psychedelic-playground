attribute float aAge;
attribute float aLife;

uniform float uPixelRatio;

varying float vAlpha;
varying vec3  vColor;

void main() {
  vAlpha = 1.0 - smoothstep(0.0, 1.0, aAge / aLife);
  vColor = mix(vec3(0.0, 0.9, 0.7), vec3(0.4, 1.0, 0.1), vAlpha);
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = (3.0 + vAlpha * 2.0) * uPixelRatio;
  gl_Position = projectionMatrix * mvPos;
}
