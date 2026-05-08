precision highp float;

varying float vAlpha;

void main() {
  // Soft circular point
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float alpha = (1.0 - smoothstep(0.3, 0.5, d)) * vAlpha;
  // Electric teal/green color
  vec3 col = mix(vec3(0.0, 0.9, 0.7), vec3(0.4, 1.0, 0.1), vAlpha);
  gl_FragColor = vec4(col, alpha * 0.85);
}
