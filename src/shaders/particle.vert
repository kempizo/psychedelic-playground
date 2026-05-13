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

vec3 saturateParticle(vec3 col, float sat) {
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  return clamp(mix(vec3(luma), col, sat), 0.0, 1.0);
}

void main() {
  float life = aLife;
  float age  = aAge;
  float norm = clamp(age / max(life, 0.001), 0.0, 1.0);
  float fadeIn = smoothstep(0.0, 0.08, norm);
  float fadeOut = 1.0 - smoothstep(0.54, 1.0, norm);
  float fade = fadeIn * fadeOut;
  float depth01 = clamp(aDepth, 0.0, 1.0);
  float farDust = 1.0 - smoothstep(0.34, 0.62, depth01);
  float nearPollen = smoothstep(0.70, 0.94, depth01);
  float beatSoft = 0.75 + 0.25 * sin(uBeatPhase * 6.28318 + depth01 * 2.0);
  float densityAlpha = mix(0.58, 0.88, clamp(uParticleDensity, 0.0, 2.0) * 0.5);
  float depthAlpha = mix(0.48, 1.0, depth01) * (1.0 - nearPollen * 0.14) * (1.0 - farDust * 0.18);
  float silenceCalm = 1.0 - clamp(uSilence, 0.0, 1.0) * 0.36;
  float audioLift = 0.28 + uParticleEnergy * 0.26 + uOnset * 0.06 + uAudioDetail * 0.08 + uAudioBody * 0.05;
  vAlpha = fade * depthAlpha * audioLift * beatSoft * densityAlpha * silenceCalm;

  // Type/depth zones: far dust cyan-green, embers gold/orange, spores acid/cyan.
  float typeOffset = aType < 0.5 ? 0.62
                   : aType < 1.5 ? 0.42 + uEnergy * 0.12
                                 : 0.82 + uAudioDetail * 0.08;
  float microCycle = uBeatPhase * 0.10 + uTreblePulse * 0.16 + uAudioTurbulence * 0.08;
  float t = position.x * 0.12 + position.y * 0.08 + uParticleEnergy * 0.20 + typeOffset + microCycle;
  vec3 pal = fieldPalette(t);
  vec3 dustCol = mix(pal, vec3(0.18, 0.95, 0.78), 0.48);
  vec3 emberCol = mix(pal, vec3(1.00, 0.62, 0.12), 0.58);
  vec3 sporeCol = mix(pal, vec3(0.62, 1.00, 0.16), 0.46);
  vec3 typedCol = aType < 0.5 ? dustCol : aType < 1.5 ? emberCol : sporeCol;
  typedCol = mix(typedCol, vec3(0.92, 0.96, 1.0), nearPollen * uTreblePulse * 0.18);
  vColor = saturateParticle(typedCol, 1.20 + uParticleEnergy * 0.16 + uTreblePulse * 0.12);

  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  // Depth and type affect size: sparks are small and fast, dust is larger
  float baseSize = aType < 0.5 ? 3.2 : aType < 1.5 ? 2.0 : 2.7;
  float densitySize = mix(0.72, 0.94, clamp(uParticleDensity, 0.0, 2.0) * 0.5);
  float shimmerSize = uParticleEnergy * 0.38 + uTreblePulse * 0.48 + uAudioTurbulence * 0.26 + uAudioBody * 0.16;
  float depthSize = mix(0.44, 1.10, depth01) * (1.0 + nearPollen * 0.12 - farDust * 0.08);
  gl_PointSize = (baseSize + vAlpha * 0.72 + shimmerSize) * depthSize * uPixelRatio * densitySize * (0.86 + silenceCalm * 0.14);
  gl_Position = projectionMatrix * mvPos;
}
