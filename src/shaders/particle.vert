attribute float aAge;
attribute float aLife;

uniform float uPixelRatio;

varying float vAlpha;

void main() {
  vAlpha = 1.0 - smoothstep(0.0, 1.0, aAge / aLife);
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = (3.0 + vAlpha * 2.0) * uPixelRatio;
  gl_Position = projectionMatrix * mvPos;
}
