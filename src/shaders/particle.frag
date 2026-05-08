precision highp float;

varying float vAlpha;
varying vec3  vColor;

void main() {
  vec2  uv = gl_PointCoord - 0.5;
  float d  = length(uv);

  float core  = (1.0 - smoothstep(0.20, 0.40, d)) * vAlpha;
  float bloom = (1.0 - smoothstep(0.0,  0.50, d)) * vAlpha * 0.35;

  float alpha = core * 0.90 + bloom;
  gl_FragColor = vec4(vColor, alpha);
}
