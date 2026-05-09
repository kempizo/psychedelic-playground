attribute float aAge;
attribute float aLife;
attribute float aType;
attribute float aDepth;

uniform float uPixelRatio;
uniform int   uPaletteFamily;
uniform float uPaletteFamilyBlend;
uniform float uPaletteShift;
uniform float uEnergy;

varying float vAlpha;
varying vec3  vColor;

// Open neon palette — must stay in sync with psychedelic.frag
vec3 fieldPalette(float t) {
  float phaseOffset = uPaletteFamilyBlend * 0.33 + uPaletteShift * 0.20;
  t += phaseOffset;
  vec3 a = vec3(0.50, 0.45, 0.55);
  vec3 b = vec3(0.50, 0.50, 0.50);
  vec3 c = vec3(1.00, 1.00, 0.50);
  vec3 d = vec3(0.00, 0.33, 0.67);
  return a + b * cos(6.28318 * (c * t + d));
}

void main() {
  float life = aLife;
  float age  = aAge;
  float norm = clamp(age / max(life, 0.001), 0.0, 1.0);
  vAlpha = (1.0 - smoothstep(0.0, 1.0, norm)) * aDepth;

  // Palette offset per type; energy pushes sparks toward magenta/cyan
  float typeOffset = aType < 0.5 ? 0.10
                   : aType < 1.5 ? 0.30 + uEnergy * 0.20
                                 : 0.55;
  float t = position.x * 0.15 + position.y * 0.10 + uEnergy * 0.25 + typeOffset;
  vColor = fieldPalette(t);

  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  // Depth and type affect size: sparks are small and fast, dust is larger
  float baseSize = aType < 0.5 ? 4.0 : aType < 1.5 ? 2.5 : 3.5;
  gl_PointSize = (baseSize + vAlpha * 2.0) * aDepth * uPixelRatio;
  gl_Position = projectionMatrix * mvPos;
}
