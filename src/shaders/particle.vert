attribute float aAge;
attribute float aLife;
attribute float aType;
attribute float aDepth;

uniform float uPixelRatio;
uniform int   uPaletteFamily;
uniform float uPaletteFamilyBlend;
uniform float uPaletteShift;
uniform float uEnergy;
uniform float uParticleEnergy;
uniform float uBeatPhase;

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
  float fade = (1.0 - smoothstep(0.0, 1.0, norm));
  float beatSoft = 0.75 + 0.25 * sin(uBeatPhase * 6.28318 + aDepth * 2.0);
  vAlpha = fade * aDepth * (0.38 + uParticleEnergy * 0.38) * beatSoft;

  // Palette offset per type; energy pushes sparks toward magenta/cyan
  float typeOffset = aType < 0.5 ? 0.10
                   : aType < 1.5 ? 0.30 + uEnergy * 0.20
                                 : 0.55;
  float t = position.x * 0.15 + position.y * 0.10 + uParticleEnergy * 0.25 + typeOffset;
  vColor = fieldPalette(t);

  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  // Depth and type affect size: sparks are small and fast, dust is larger
  float baseSize = aType < 0.5 ? 3.6 : aType < 1.5 ? 2.2 : 3.0;
  gl_PointSize = (baseSize + vAlpha * 1.4 + uParticleEnergy * 1.2) * aDepth * uPixelRatio;
  gl_Position = projectionMatrix * mvPos;
}
