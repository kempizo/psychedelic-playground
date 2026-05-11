precision highp float;

varying float vAlpha;
varying vec3  vColor;

void main() {
  vec2  uv = gl_PointCoord - 0.5;
  float d  = length(uv);

  float core  = (1.0 - smoothstep(0.08, 0.34, d)) * vAlpha;
  float bloom = (1.0 - smoothstep(0.12, 0.50, d)) * vAlpha * 0.22;

  float alpha = core * 0.72 + bloom;
  gl_FragColor = vec4(vColor, alpha);
}
