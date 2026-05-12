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
uniform float uParticleDensity;
uniform float uTreblePulse;
uniform float uOnset;
uniform float uAudioBody;
uniform float uAudioDetail;
uniform float uAudioTurbulence;
uniform float uSilence;

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
  float densityAlpha = mix(0.72, 1.25, clamp(uParticleDensity, 0.0, 2.0) * 0.5);
  float silenceCalm = 1.0 - clamp(uSilence, 0.0, 1.0) * 0.28;
  float audioLift = 0.34 + uParticleEnergy * 0.30 + uOnset * 0.08 + uAudioDetail * 0.10 + uAudioBody * 0.06;
  vAlpha = fade * aDepth * audioLift * beatSoft * densityAlpha * silenceCalm;

  // Palette offset per type; energy pushes sparks toward magenta/cyan
  float typeOffset = aType < 0.5 ? 0.10
                   : aType < 1.5 ? 0.30 + uEnergy * 0.20
                                 : 0.55;
  float t = position.x * 0.15 + position.y * 0.10 + uParticleEnergy * 0.25 + typeOffset;
  vColor = fieldPalette(t);

  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  // Depth and type affect size: sparks are small and fast, dust is larger
  float baseSize = aType < 0.5 ? 3.6 : aType < 1.5 ? 2.2 : 3.0;
  float densitySize = mix(0.82, 1.18, clamp(uParticleDensity, 0.0, 2.0) * 0.5);
  float shimmerSize = uParticleEnergy * 0.80 + uTreblePulse * 1.10 + uAudioTurbulence * 0.65 + uAudioBody * 0.35;
  gl_PointSize = (baseSize + vAlpha * 1.35 + shimmerSize) * aDepth * uPixelRatio * densitySize * (0.88 + silenceCalm * 0.12);
  gl_Position = projectionMatrix * mvPos;
}
