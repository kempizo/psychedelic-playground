precision highp float;

uniform float uTime;
uniform vec2  uResolution;
uniform float uBass;
uniform float uLowMid;
uniform float uMid;
uniform float uHighMid;
uniform float uTreble;
uniform float uHi;
uniform float uSub;
uniform float uRms;
uniform float uOnset;
uniform float uBassPulse;
uniform float uMidPulse;
uniform float uTreblePulse;
uniform float uSilence;
uniform float uSpeed;
uniform float uIntensity;
uniform float uColorShift;
uniform float uChaos;
uniform int   uMode;
uniform vec2  uMouse;
uniform float uMouseVel;
uniform vec4  uForces[8];
uniform float uColorSpike;
uniform float uDistortionSpike;
uniform vec2  uMouseDir;
uniform vec4  uForceMeta[8];
uniform float uEnergy;
uniform int   uPaletteFamily;
uniform float uPaletteFamilyBlend;
uniform float uPaletteShift;
uniform float uBassMid;
uniform float uMidHi;
uniform float uBassHi;
uniform float uCoreEnergy;
uniform float uSurfaceEnergy;
uniform float uParticleEnergy;
uniform float uBeatPhase;
uniform float uPalettePhase;
uniform vec4  uModeBlend;
uniform float uCameraDistance;
uniform float uSpectralCentroid;
uniform float uSpectralFlux;
uniform float uProcIntensity;
uniform float uAudioBody;
uniform float uAudioMorph;
uniform float uAudioDetail;
uniform float uAudioPulse;
uniform float uAudioBrightness;
uniform float uAudioTurbulence;
// Slow-decaying sub-bass accumulator — adds lazy drift weight to camera position
uniform vec2  uCamDrift;

varying vec2 vUv;

const float TAU = 6.28318530718;

// ── 2D noise (quintic Perlin) ──────────────────────────────────────────────────
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(
    mix(dot(hash2(i),              f),
        dot(hash2(i + vec2(1,0)),  f - vec2(1,0)), u.x),
    mix(dot(hash2(i + vec2(0,1)),  f - vec2(0,1)),
        dot(hash2(i + vec2(1,1)),  f - vec2(1,1)), u.x), u.y);
}

// Cheap 3D noise: three 2D slices — avoids full 8-corner 3D interpolation
float noise3(vec3 p) {
  return (noise(p.xy + p.z * 1.7321)
        + noise(p.yz + p.x * 2.3107)
        + noise(p.xz + p.y * 1.5731)) * 0.3333;
}

// 6-octave 2D FBM. Top octave gated by energy+midHi so idle is smoother.
float fbm(vec2 p) {
  float v = 0.0, a = 0.5, f = 1.0;
  float topGate = mix(0.0, 1.0, smoothstep(0.10, 0.50, uEnergy + uMidHi * 0.4 + uTreblePulse * 0.16));
  for (int i = 0; i < 6; i++) {
    float contrib = a * noise(p * f);
    if (i == 5) contrib *= topGate;
    v += contrib;
    f *= 2.1; a *= 0.48;
  }
  return v;
}

vec2 fbm2(vec2 p) {
  vec2 v = vec2(0.0);
  float a = 0.50;
  float f = 1.0;
  for (int i = 0; i < 4; i++) {
    v += a * vec2(
      noise(p * f + vec2(17.31, 9.17)),
      noise((p + vec2(5.13, 21.71)) * f)
    );
    f *= 2.03;
    a *= 0.50;
  }
  return v;
}

vec2 toPolar(vec2 p) {
  return vec2(length(p), atan(p.y, p.x));
}

vec2 fromPolar(vec2 polar) {
  return vec2(cos(polar.y), sin(polar.y)) * polar.x;
}

vec2 kaleidoFold(vec2 p, float sectors, float phase, float amount) {
  vec2 polar = toPolar(p);
  float seg = TAU / max(2.0, sectors);
  float folded = abs(mod(polar.y + phase + seg * 0.5, seg) - seg * 0.5);
  polar.y = mix(polar.y, folded - phase, clamp(amount, 0.0, 1.0));
  return fromPolar(polar);
}

vec2 spiralWarp(vec2 p, float amount, float phase) {
  vec2 polar = toPolar(p);
  float centerFalloff = 1.0 - smoothstep(0.05, 2.05, polar.x);
  float rimFalloff = smoothstep(0.15, 1.45, polar.x) * (1.0 - smoothstep(1.1, 2.4, polar.x));
  polar.y += amount * centerFalloff + sin(polar.x * 4.0 + phase) * amount * 0.42 * rimFalloff;
  polar.x *= 1.0 + sin(polar.y * 3.0 - phase) * amount * 0.018;
  return fromPolar(polar);
}

float orbitTrapMask(vec2 p, float phase) {
  vec2 z = p;
  float trap = 1.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    z = abs(z);
    z = z / max(dot(z, z), 0.30) - vec2(0.76 + 0.04 * sin(phase + fi), 0.48 + 0.03 * cos(phase * 0.7 + fi));
    float c = cos(phase + fi * 1.27);
    float s = sin(phase + fi * 1.27);
    z = mat2(c, s, -s, c) * z;
    trap = min(trap, abs(z.x * z.y));
  }
  return 1.0 - smoothstep(0.010, 0.070, trap);
}

vec2 warpField(vec2 p, float tBase, float tDetail) {
  float audioPresence = 1.0 - smoothstep(0.45, 1.0, uSilence);
  float quietHold = mix(0.52, 1.0, audioPresence);
  vec2 slowDrift = vec2(
    sin(tBase * 0.47 + uCamDrift.x * 1.7),
    cos(tBase * 0.39 + uCamDrift.y * 1.5)
  ) * 0.16;

  vec2 q = fbm2(p * (0.58 + uChaos * 0.25) + slowDrift + vec2(tBase * 0.035, -tBase * 0.028));
  vec2 r = fbm2(p * (1.06 + uSurfaceEnergy * 0.18) + q * (1.04 + uChaos * 0.52)
              + vec2(-tBase * 0.045 + tDetail * 0.012, tBase * 0.038));

  float broadAmp = (0.055 + uChaos * 0.13 + uProcIntensity * 0.030 + uCoreEnergy * 0.045) * quietHold;
  float detailAmp = (0.030 + uSurfaceEnergy * 0.055 + uMidHi * 0.016 + uBassMid * 0.014) * quietHold;
  vec2 curlish = vec2(r.y - q.y, q.x - r.x);

  return p + q * broadAmp + r * detailAmp + curlish * (uMidPulse * 0.012 + uBassPulse * 0.010) * audioPresence;
}

// 3-octave 3D FBM (SDF surface displacement — budget-conscious)
float fbm3(vec3 p) {
  float v = 0.0, a = 0.5, f = 1.0;
  for (int i = 0; i < 3; i++) { v += a * noise3(p * f); f *= 2.1; a *= 0.45; }
  return v;
}

// ── Open neon palette (IQ cosine form) ────────────────────────────────────────
// cyan → violet → magenta → acid-green spectrum.
// uPaletteFamily stays available as the snapped mode family; uPaletteFamilyBlend
// eases the same 0→1 family transition to avoid a hard palette jump.
// uPaletteShift adds a transient break-event shift on top.
// Brightness is localized (dark base + mid-amplitude swing); no full-frame colour flashes.
vec3 palette(float t) {
  float cent = clamp(uSpectralCentroid, 0.0, 1.0);
  float phaseOffset = uPaletteFamilyBlend * 0.33 + uPaletteShift * 0.20
                    + uPalettePhase * 0.16 + uColorShift * 0.12 + uAudioMorph * 0.035;
  t += phaseOffset;
  vec3 a = vec3(0.50, 0.45, 0.55);
  vec3 b = vec3(0.50, 0.50, 0.50);
  vec3 c = vec3(1.00, 1.00, 0.50);
  vec3 d = vec3(0.00, 0.33, 0.67);
  vec3 col = a + b * cos(TAU * (c * t + d));

  float temperature = clamp(cent * 0.72 + uAudioBrightness * 0.28, 0.0, 1.0);
  vec3 coolTint = vec3(0.84, 1.02, 1.10);
  vec3 brightTint = vec3(1.04, 1.00, 0.76);
  vec3 familyTint = mix(vec3(0.92, 1.06, 0.98), vec3(1.08, 0.88, 1.10), uPaletteFamilyBlend);
  col *= mix(coolTint, brightTint, temperature * 0.68) * familyTint;
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.08 + uAudioDetail * 0.06);
  return clamp(col, 0.0, 1.0);
}

// ── SDF: organic blob ──────────────────────────────────────────────────────────
// tBase param is the slow evolution time used for the ambient breathing term
float sdfBlob(vec3 p, float t, float tBase, float bass, float mid, float chaos) {
  float warp = chaos * (1.0 + uSurfaceEnergy * 0.48 + uLowMid * 0.16) + 0.3 + uBassPulse * 0.06;
  vec3 q = p + warp * 0.35 * vec3(
    sin(p.y * 2.1 + t * 1.1) + cos(p.z * 1.7 + t * 0.8),
    cos(p.x * 1.9 + t * 0.7) + sin(p.z * 2.3 + t * 1.2),
    sin(p.x * 1.5 + t * 0.9) + cos(p.y * 2.7 + t * 0.6)
  );
  float coreFlow = fbm3(q * (0.72 + uRms * 0.08) + tBase * 0.08) * (0.18 + uCoreEnergy * 0.22 + uBassPulse * 0.04);
  float surfaceFlow = fbm3(q * (1.45 + uSurfaceEnergy * 0.45 + uHighMid * 0.18) + t * 0.17) * (0.12 + mid * 0.18 + uLowMid * 0.08 + uSurfaceEnergy * 0.20);
  float disp = coreFlow + surfaceFlow + uBassMid * 0.08 + uMidPulse * 0.035;
  // Two incommensurate sinusoids ensure the orb is always alive at silence
  float breath = sin(tBase * 0.7) * 0.015 + sin(tBase * 0.31) * 0.008;
  return (length(q) - (0.86 + uCoreEnergy * 0.22 + bass * 0.10 + uBassPulse * 0.045 + disp + breath)) * 0.70;
}

// Orbit mode: three copies of blob 120° apart, collapse via min
float sdfOrbit(vec3 p, float t, float tBase, float bass, float mid, float chaos) {
  float rotPhase = tBase * 0.4 + mid * 1.8;
  float sep = 0.35 + mid * 0.55;

  // Rotate p around Z axis at three phases
  float c0 = cos(rotPhase),          s0 = sin(rotPhase);
  float c1 = cos(rotPhase + 2.094),  s1 = sin(rotPhase + 2.094);
  float c2 = cos(rotPhase + 4.189),  s2 = sin(rotPhase + 4.189);

  vec3 p0 = vec3(p.x + c0 * sep, p.y + s0 * sep, p.z);
  vec3 p1 = vec3(p.x + c1 * sep, p.y + s1 * sep, p.z);
  vec3 p2 = vec3(p.x + c2 * sep, p.y + s2 * sep, p.z);

  float d0 = sdfBlob(p0, t, tBase, bass * 0.7, mid, chaos);
  float d1 = sdfBlob(p1, t, tBase, bass * 0.7, mid, chaos);
  float d2 = sdfBlob(p2, t, tBase, bass * 0.7, mid, chaos);
  return min(min(d0, d1), d2);
}

// Forward-difference normals: 4 SDF evals (vs 6 for central differences)
vec3 calcNormal(vec3 p, float t, float tBase, float bass, float mid, float chaos, int mode) {
  float eps = 0.012;
  float c;
  if (mode == 4) {
    c = sdfOrbit(p, t, tBase, bass, mid, chaos);
    return normalize(vec3(
      sdfOrbit(p + vec3(eps, 0.0, 0.0), t, tBase, bass, mid, chaos) - c,
      sdfOrbit(p + vec3(0.0, eps, 0.0), t, tBase, bass, mid, chaos) - c,
      sdfOrbit(p + vec3(0.0, 0.0, eps), t, tBase, bass, mid, chaos) - c
    ));
  } else {
    c = sdfBlob(p, t, tBase, bass, mid, chaos);
    return normalize(vec3(
      sdfBlob(p + vec3(eps, 0.0, 0.0), t, tBase, bass, mid, chaos) - c,
      sdfBlob(p + vec3(0.0, eps, 0.0), t, tBase, bass, mid, chaos) - c,
      sdfBlob(p + vec3(0.0, 0.0, eps), t, tBase, bass, mid, chaos) - c
    ));
  }
}

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2  sUV    = (vUv * 2.0 - 1.0) * vec2(aspect, 1.0);
  // Layered time: tBase drives slow evolution; tDetail drives fine noise on top octaves only
  float tBase   = uTime * uSpeed * 0.18;
  float tDetail = uTime * uSpeed * 0.6;
  float t       = tBase;
  float tJitter = tBase + noise(vec2(tBase * 0.027, 0.71)) * 0.14;

  // ── NDC position for force field evaluation (un-aspect-corrected) ─────────
  vec2 ndcUV = vUv * 2.0 - 1.0;

  // ── Force field: clicks/drags warp the FBM domain rather than drawing rings ─
  // uForces[i]:    xy=origin, z=strength (signed: +push/-pull), w=age0to1
  // uForceMeta[i]: xy=velocity, z=radius, w=unused
  vec2  forceDisplace = vec2(0.0);
  float forceEnergySum = 0.0;

  for (int i = 0; i < 8; i++) {
    vec4 fo  = uForces[i];
    vec4 fm  = uForceMeta[i];
    if (abs(fo.z) < 0.001 || fo.w > 0.999) continue;

    float r2     = fm.z * fm.z;
    vec2  delta  = ndcUV - fo.xy;
    float d2     = dot(delta, delta);
    float falloff = exp(-d2 / max(r2, 0.0001));

    // Push: warp outward from origin; pull: warp inward
    vec2 dir = length(delta) > 0.0001 ? normalize(delta) : vec2(0.0, 1.0);
    forceDisplace  += falloff * sign(fo.z) * dir * abs(fo.z) * (1.0 - fo.w);
    forceEnergySum += falloff * abs(fo.z) * (1.0 - fo.w);
  }
  forceEnergySum = clamp(forceEnergySum, 0.0, 1.0);
  // Inject into screen UV so force disturbances feed into camera + FBM chain
  sUV += forceDisplace * (0.16 + uBassPulse * 0.04);
  sUV += uMouseDir * uMouseVel * 0.06;

  // Break-event shimmer: sinusoidal screen warp driven by uDistortionSpike
  sUV += vec2(
    sin(sUV.y * 5.3 + uTime * 3.1) * uDistortionSpike * 0.028,
    cos(sUV.x * 4.8 + uTime * 2.7) * uDistortionSpike * 0.022
  ) * uDistortionSpike;

  // Shared organic coordinates: evaluated once, then reused by camera/layers.
  float audioPresence = 1.0 - smoothstep(0.52, 1.0, uSilence);
  float modeRadial = clamp(uModeBlend.x, 0.0, 1.0);
  float modeVortex = clamp(uModeBlend.y, 0.0, 1.0);
  float modeCollapse = clamp(uModeBlend.z, 0.0, 1.0);
  float modeOrbit = clamp(uModeBlend.w, 0.0, 1.0);
  float modeFluid = clamp(1.0 - max(max(modeRadial, modeVortex), max(modeCollapse, modeOrbit)), 0.0, 1.0);

  vec2 fieldUV = warpField(sUV, tBase, tDetail);
  float fieldDetail = 0.5 + 0.5 * fbm(fieldUV * 0.46 + vec2(tBase * 0.030, -tBase * 0.024));
  float modeBias = (fieldDetail - 0.5) * (0.32 + uModeBlend.x * 0.20 + uModeBlend.y * 0.16 + uModeBlend.w * 0.14);

  float spiralAmount = (0.026 + uAudioMorph * 0.060 + uAudioPulse * 0.030 + uAudioTurbulence * 0.030)
                     * (0.32 + modeFluid * 0.28 + modeRadial * 0.30 + modeVortex * 1.35 + modeCollapse * 0.42 + modeOrbit * 0.46)
                     * mix(0.48, 1.0, audioPresence);
  fieldUV = spiralWarp(fieldUV, spiralAmount, tBase * (0.40 + modeVortex * 0.32) + uAudioTurbulence * 1.35 + modeBias * 0.45);

  float foldSectors = 4.5 + modeRadial * 3.0 + modeOrbit * 1.5 + modeCollapse * 0.7;
  float foldPhase = tBase * (0.16 + modeVortex * 0.22 + modeOrbit * 0.28)
                  + uAudioPulse * 0.42 + modeOrbit * 2.094;
  float kaleidoMix = (0.014 + modeFluid * 0.008 + modeRadial * 0.105 + modeVortex * 0.050 + modeCollapse * 0.030 + modeOrbit * 0.082)
                   * (0.58 + audioPresence * 0.42 + uAudioMorph * 0.18);
  vec2 foldedUV = kaleidoFold(fieldUV, foldSectors, foldPhase, 1.0);
  fieldUV = mix(fieldUV, foldedUV, kaleidoMix);

  float collapsePull = modeCollapse * (0.024 + uAudioBody * 0.050 + uAudioPulse * 0.026)
                     * (1.0 - smoothstep(0.18, 1.80, length(fieldUV)));
  fieldUV *= 1.0 - collapsePull;

  vec2 orbitOffset = vec2(cos(foldPhase), sin(foldPhase)) * (0.018 + uAudioMorph * 0.018) * modeOrbit;
  vec2 orbitFold = kaleidoFold(fieldUV + orbitOffset, 3.0, foldPhase * 0.55, 0.92) - orbitOffset;
  fieldUV = mix(fieldUV, orbitFold, modeOrbit * (0.030 + uAudioMorph * 0.040));

  vec2 fieldNdc = fieldUV / vec2(aspect, 1.0);
  sUV = fieldUV;

  // ── Mandala / radial influence layer ──────────────────────────────────────
  // Biases the FBM warp toward radial direction during peak/break. Never perfect.
  float radialBias = uEnergy * smoothstep(0.3, 0.85, uEnergy) * uPaletteShift * 0.45
                   + uCoreEnergy * smoothstep(0.3, 1.0, uCoreEnergy) * 0.14
                   + uModeBlend.x * 0.18
                   + uBassPulse * 0.035
                   + modeBias * 0.08;
  float sectorCount = 5.0 + sin(uTime * 0.07 + fieldDetail * 0.35) * 2.0;
  vec2  radialP     = fieldNdc;
  float radialAngle = atan(radialP.y, radialP.x);
  float mandalaWarp = sin(radialAngle * sectorCount + uTime * 0.3) * radialBias * 0.06;
  sUV += normalize(radialP + vec2(0.0001)) * mandalaWarp;

  float smoothSpin = (uModeBlend.y * (0.10 + uCoreEnergy * 0.24 + modeBias * 0.08)) * (1.0 - smoothstep(0.0, 1.8, length(sUV)));
  float smoothSpinAngle = atan(sUV.y, sUV.x) + smoothSpin;
  sUV = mix(sUV, vec2(cos(smoothSpinAngle), sin(smoothSpinAngle)) * length(sUV), uModeBlend.y * 0.18);

  // ── Virtual camera ─────────────────────────────────────────────────────────
  vec3 ro, rd;

  if (uMode == 0) {
    // Fluid: orbit camera outside the blob
    float orbit = t * 0.55 + uSub * 0.8;
    float tilt  = cos(t * 0.30) * 0.55 + sin(t * 0.13) * 0.18;
    float dist  = mix(2.8, uCameraDistance, 0.45) - uCoreEnergy * 0.35;

    ro = vec3(sin(orbit) * dist + uCamDrift.x, tilt + uMouse.y * 0.45, cos(orbit) * dist + uCamDrift.y);
    vec3 target  = vec3(uMouse.x * 0.45, uMouse.y * 0.25, 0.0);
    vec3 fwd     = normalize(target - ro);
    vec3 worldUp = abs(fwd.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 right   = normalize(cross(fwd, worldUp));
    vec3 up      = cross(right, fwd);
    rd = normalize(fwd + sUV.x * right * 0.65 + sUV.y * up * 0.65);

  } else if (uMode == 1) {
    // Radial: close macro orbit — clips through surface on bass, cave-like
    float r2d   = length(sUV);
    float a2d   = atan(sUV.y, sUV.x) + uTime * uSpeed * 0.06;
    vec2  sUV2  = vec2(cos(a2d), sin(a2d)) * r2d * (1.0 - uSub * 0.08);

    float orbit2 = t * 0.80 + uSub * 0.6;
    float dist2  = mix(1.2, uCameraDistance, 0.45) - uCoreEnergy * 0.18;
    ro = vec3(sin(orbit2) * dist2 + uCamDrift.x,
              cos(t * 0.35) * dist2 * 0.55 + uMouse.y * 0.35,
              cos(orbit2) * dist2 + uCamDrift.y);
    vec3 fwd2     = normalize(-ro);
    vec3 worldUp2 = abs(fwd2.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 right2   = normalize(cross(fwd2, worldUp2));
    vec3 up2      = cross(right2, fwd2);
    rd = normalize(fwd2 + sUV2.x * right2 * 0.75 + sUV2.y * up2 * 0.75);

  } else if (uMode == 2) {
    // Vortex: spiral camera rotation proportional to sub+bass; center pull on p
    float vortexAngle = tBase * 0.65 + (uSub + uBass) * 1.4;
    float r2d   = length(sUV);
    // Spiral: rotate UV by an angle that increases toward center
    float spinAmount = (uSub * 0.4 + uBass * 0.6) * 0.8 + tBase * 0.05;
    float a2d   = atan(sUV.y, sUV.x) + spinAmount * (1.0 - smoothstep(0.0, 1.8, r2d));
    vec2  sUV2  = vec2(cos(a2d), sin(a2d)) * r2d;

    float orbit = vortexAngle;
    float dist  = mix(2.2, uCameraDistance, 0.45) - uCoreEnergy * 0.28;
    ro = vec3(sin(orbit) * dist + uCamDrift.x, cos(t * 0.22) * 0.7 + uMouse.y * 0.5, cos(orbit) * dist + uCamDrift.y);
    vec3 fwd     = normalize(-ro + vec3(uMouse.x * 0.3, 0.0, 0.0));
    vec3 worldUp = abs(fwd.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 right   = normalize(cross(fwd, worldUp));
    vec3 up      = cross(right, fwd);
    rd = normalize(fwd + sUV2.x * right * 0.70 + sUV2.y * up * 0.70);

  } else if (uMode == 3) {
    // Collapse: ray origin oscillates inward on bass kick, outward on mid
    float collapseZ = mix(2.4, uCameraDistance, 0.45) - uCoreEnergy * 0.40 + uSurfaceEnergy * 0.24;
    float orbit = tBase * 0.45 + uSub * 0.5;
    float tilt  = sin(tBase * 0.28) * 0.40 + uMouse.y * 0.4;
    ro = vec3(sin(orbit) * collapseZ + uCamDrift.x, tilt, cos(orbit) * collapseZ + uCamDrift.y);
    vec3 target  = vec3(uMouse.x * 0.35, uMouse.y * 0.15, 0.0);
    vec3 fwd     = normalize(target - ro);
    vec3 worldUp = abs(fwd.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 right   = normalize(cross(fwd, worldUp));
    vec3 up      = cross(right, fwd);
    rd = normalize(fwd + sUV.x * right * 0.60 + sUV.y * up * 0.60);

  } else {
    // Orbit (mode 4): standard Fluid-like camera, SDF uses 3-copy orbit
    float orbit = t * 0.50 + uSub * 0.7;
    float tilt  = cos(t * 0.27) * 0.50 + sin(t * 0.15) * 0.15;
    float dist  = mix(3.0, uCameraDistance, 0.45) - uCoreEnergy * 0.24;
    ro = vec3(sin(orbit) * dist + uCamDrift.x, tilt + uMouse.y * 0.40, cos(orbit) * dist + uCamDrift.y);
    vec3 target  = vec3(uMouse.x * 0.40, uMouse.y * 0.20, 0.0);
    vec3 fwd     = normalize(target - ro);
    vec3 worldUp = abs(fwd.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 right   = normalize(cross(fwd, worldUp));
    vec3 up      = cross(right, fwd);
    rd = normalize(fwd + sUV.x * right * 0.65 + sUV.y * up * 0.65);
  }

  // ── Sphere tracer (40 steps) ───────────────────────────────────────────────
  float tRay    = 0.08;
  float hitDist = -1.0;
  float minD    = 100.0;
  float maxDist = 8.0;

  for (int i = 0; i < 40; i++) {
    vec3  p = ro + rd * tRay;
    float d;
    if (uMode == 4) {
      d = sdfOrbit(p, tJitter, tBase, uBass, uMid, uChaos);
    } else {
      float collapseMod = uMode == 3 ? (uBass - uMid) * 0.20 : 0.0;
      d = sdfBlob(p, tJitter, tBase, uBass + collapseMod, uMid, uChaos);
    }
    minD = min(minD, abs(d));
    if (abs(d) < 0.006) { hitDist = tRay; break; }
    tRay += max(abs(d) * 0.55, 0.015);
    if (tRay > maxDist) break;
  }

  // depth01: 0 = close foreground, 1 = far background / miss
  float depth01   = clamp(tRay / maxDist, 0.0, 1.0);
  float depthFog  = 1.0 - exp(-tRay * 0.032);
  // Atmospheric fog color: cool near-black tinted by current palette
  vec3  fogColor  = palette(uPaletteShift * 0.5 + fieldDetail * 0.08) * (0.035 + fieldDetail * 0.012);

  vec3 col = vec3(0.0);

  if (hitDist > 0.0) {
    // ── Surface: diffuse volume + gated detail ──────────────────────────────
    vec3  p    = ro + rd * hitDist;
    vec3  nrm  = calcNormal(p, tJitter, tBase, uBass, uMid, uChaos, uMode);
    vec3  lDir = normalize(vec3(sin(t * 0.35) * 1.2, 0.8, cos(t * 0.35) * 1.2));

    float diff    = max(0.0, dot(nrm, lDir)) * 0.48 + 0.26 + uCoreEnergy * 0.12;

    // t driven by value + energy + depth: foreground/high-energy → magenta/cyan
    float noiseV  = fbm3(p * 0.55 + t * 0.08);
    float surfaceDetail = fbm3(p * (2.0 + uSurfaceEnergy * 1.2 + uHighMid * 0.7) + tDetail * (0.16 + uTreble * 0.035));
    float surfDepth = clamp(hitDist / maxDist, 0.0, 1.0);
    float ct      = noiseV * 0.25 + uEnergy * 0.30 + (1.0 - surfDepth) * 0.25
                  + uPaletteShift * 0.20 + uColorShift * 0.25 + uMidHi * 0.08
                  + surfaceDetail * (uSurfaceEnergy * 0.10 + uMidPulse * 0.03)
                  + uSpectralCentroid * 0.04 + uAudioBrightness * 0.07 + uAudioMorph * 0.04;

    col  = palette(ct) * diff;
    col += palette(ct + 0.18) * surfaceDetail * (uSurfaceEnergy * 0.12 + uHighMid * 0.035);
    float viewSoft = pow(1.0 - abs(dot(nrm, -rd)), 2.6);
    col += palette(ct + 0.35) * viewSoft * (0.09 + uHi * 0.055) * (1.0 - surfDepth * 0.42);
    col += palette(ct + 0.50) * 0.04;
    col += uCoreEnergy * palette(ct + 0.15) * 0.13;
    col *= (1.0 - surfDepth * 0.15);
    // Atmospheric fog: blend toward near-black at depth
    col  = mix(col, fogColor, smoothstep(0.3, 0.9, surfDepth));

  } else {
    // ── Volumetric glow: near-miss rays accumulate fog ───────────────────────
    // Glow stronger in foreground (small depth01), fades at back
    float glowStr = mix(0.34, 0.14, depth01);
    float glow    = exp(-minD * 3.1) * glowStr;
    vec2 bgFlow = vec2(
      sin(t * 0.04 + fieldUV.y * 0.65) * 0.18,
      cos(t * 0.035 + fieldUV.x * 0.55) * 0.14
    ) + vec2(uLowMid * 0.025, -uBassPulse * 0.018);
    float bgN = fbm(fieldUV * 0.42 + bgFlow + vec2(uPalettePhase * 0.05, -uPalettePhase * 0.03));
    float bgT = bgN * 0.36 + 0.72 + uColorShift * 0.3 + uAudioBrightness * 0.04;
    vec3 bgFog = palette(bgT + 0.12 + fieldDetail * 0.06) * (0.018 + bgN * 0.022 + fieldDetail * 0.008 + uCoreEnergy * 0.012);
    col  = palette(bgT) * glow * (0.18 + uCoreEnergy * 0.18);
    col += bgFog;
    col *= (1.0 - depthFog * 0.34);
    col += palette(bgT + 0.30) * depthFog * 0.024 * (0.4 + uCoreEnergy * 0.16);
    col  = mix(col, fogColor, smoothstep(0.5, 1.0, depth01));
  }

  // ── Subsurface proximity glow ─────────────────────────────────────────────
  float proxGlow = exp(-minD * minD * 24.0);
  float proxT    = fbm(fieldUV * 0.28 + vec2(t * 0.05, 0.0)) * 0.4 + fieldDetail * 0.08 + 0.72 + uColorShift * 0.3;
  float proxMask = hitDist > 0.0 ? 0.82 : smoothstep(0.22, 0.78, proxGlow);
  col += palette(proxT + 0.15) * proxGlow * proxMask * (0.10 + uCoreEnergy * 0.20);

  // Secondary procedural texture, gated by flux so transients reveal detail
  // without flashing the whole frame.
  float fluxLift = smoothstep(0.02, 0.42, uSpectralFlux) * uProcIntensity;
  float cent = clamp(uSpectralCentroid, 0.0, 1.0);
  vec2 procFlow = vec2(
    noise(fieldUV * 0.55 + vec2(tBase * 0.08, cent * 1.7)),
    noise(fieldUV * 0.50 + vec2(-cent * 1.3, tBase * -0.06))
  );
  float procN = 0.5 + 0.5 * noise(fieldUV * (0.85 + cent * 1.25) + procFlow * 0.42 + vec2(tBase * 0.05, -tBase * 0.04));
  float procMask = smoothstep(0.38, 0.82, procN);
  float localMask = hitDist > 0.0 ? 0.62 : smoothstep(0.18, 0.72, proxGlow);
  float procStrength = (0.020 + fluxLift * 0.12 + uTreblePulse * 0.018 + uAudioDetail * 0.016 + uAudioTurbulence * 0.022)
                     * uProcIntensity * localMask * (0.42 + uSurfaceEnergy * 0.50);
  col += palette(procN * 0.22 + cent * 0.18 + uPalettePhase * 0.12 + 0.58) * procMask * procStrength;

  // ── Energy filaments: sparse curved streaks, visible only during energetic moments ──
  // Threshold FBM at a tight band → sparse arcs; mask by energy+force so they
  // only surface during peaks. No second pass needed — lives in the same shader.
  float energyMask = clamp(forceEnergySum * 0.80 + uSurfaceEnergy * 0.64 + uParticleEnergy * 0.26 + uBassHi * 0.30 + uMidPulse * 0.14, 0.0, 1.0);
  if (energyMask > 0.08) {
    vec2  filUV  = fieldUV * 3.8 + vec2(t * 0.06 + modeBias * 0.08, t * -0.04);
    float filN   = fbm(filUV);
    float filLine = smoothstep(0.54, 0.58, filN) * smoothstep(0.62, 0.58, filN);
    float trapLine = orbitTrapMask(filUV * (0.22 + modeCollapse * 0.05 + modeOrbit * 0.04), tBase * 0.32 + uAudioMorph * 0.9 + modeBias);
    float filamentMix = clamp(0.30 + modeCollapse * 0.34 + modeOrbit * 0.18 + uAudioDetail * 0.22, 0.0, 0.82);
    filLine = mix(filLine, trapLine, filamentMix);
    float filT    = filN * 0.3 + uEnergy * 0.4 + uColorShift * 0.2 + uAudioBrightness * 0.08;
    col += palette(filT) * filLine * energyMask * (0.27 + uAudioDetail * 0.18);
  }

  // ── Force-energy brightness: forces locally amplify field brightness ────────
  col += palette(t * 0.4 + 0.5) * forceEnergySum * (0.19 + uBassPulse * 0.07);
  col += palette(t * 0.4 + 0.5) * uColorSpike * 0.18;

  // ── Mouse energy ripple ────────────────────────────────────────────────────
  float mDist = length(fieldUV - uMouse);
  col += palette(t * 0.4 + 0.5) * exp(-mDist * 3.2) * uMouseVel * 0.38;

  // ── Hi shimmer + intensity ─────────────────────────────────────────────────
  float fineSpark = smoothstep(0.08, 0.78, uHighMid + uTreblePulse * 0.45) * (0.028 + uTreble * 0.018);
  col += (uHi * 0.040 + fineSpark) * vec3(0.0, 0.68, 0.54);
  col *= 1.0 - modeCollapse * (0.08 + uAudioBody * 0.06) * (1.0 - smoothstep(0.40, 1.60, length(vUv * 2.0 - 1.0)));
  float exposure = clamp(0.54 + uIntensity * 0.50 + uAudioBrightness * 0.16 + uRms * 0.10 - uSilence * 0.10, 0.46, 1.18);
  col *= exposure;

  // ── Vignette ───────────────────────────────────────────────────────────────
  float vig = 1.0 - smoothstep(0.72, 1.55, length(vUv * 2.0 - 1.0)) * 0.78;
  col *= vig;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
