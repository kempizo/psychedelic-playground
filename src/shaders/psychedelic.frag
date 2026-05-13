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
uniform vec4  uEngineA;
uniform vec4  uEngineB;
uniform vec4  uEngineC;
uniform vec4  uEngineD;
// Tunnel / portal depth layer (Stage 11)
//   uTunnelA: x=depth, y=inward, z=gills, w=spiral
//   uTunnelB: x=breath, y=portalBloom, z=growthWaveAge, w=growthWaveAmp
uniform vec4  uTunnelA;
uniform vec4  uTunnelB;
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

float cellularEdge(vec2 p, float phase) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  float nearest = 8.0;
  float secondNearest = 8.0;

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 seed = hash2(cell + neighbor);
      vec2 feature = 0.5 + 0.32 * sin(seed * 4.7 + phase + vec2(seed.y, seed.x) * 1.9);
      vec2 delta = neighbor + feature - f;
      float distSq = dot(delta, delta);

      if (distSq < nearest) {
        secondNearest = nearest;
        nearest = distSq;
      } else if (distSq < secondNearest) {
        secondNearest = distSq;
      }
    }
  }

  float edgeGap = sqrt(secondNearest) - sqrt(nearest);
  float softEdge = 1.0 - smoothstep(0.028, 0.170, edgeGap);
  return softEdge * softEdge * (3.0 - 2.0 * softEdge);
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
  vec2 foldedP = fromPolar(vec2(polar.x, folded - phase));
  return mix(p, foldedP, clamp(amount, 0.0, 1.0));
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
// Layered neon spectrum. Zone helpers below keep complementary contrasts
// structured instead of rotating the whole frame as a fast rainbow.
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

vec3 saturateNeon(vec3 col, float sat) {
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  return clamp(mix(vec3(luma), col, sat), 0.0, 1.0);
}

vec3 zoneColor(float t, vec3 anchor, float anchorMix, float sat) {
  vec3 col = mix(palette(t), anchor, clamp(anchorMix, 0.0, 1.0));
  return saturateNeon(col, sat);
}

vec3 deepColor(float t, vec3 anchor) {
  return zoneColor(t, anchor, 0.62, 1.18) * 0.42;
}

// ── Mandelbrot-inspired utility layer ────────────────────────────────────────
// Procedural field only: sampled after hit/miss is known, never in raymarch.
#define MANDEL_MAX_ITER 42

vec2 complexSquare(vec2 z) {
  return vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y);
}

float safeLog2(float x) {
  return log(max(x, 1e-6)) / log(2.0);
}

mat2 rot2(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

vec3 mandelPalette(float t, float heat) {
  vec3 cold = palette(t + heat * 0.035);
  vec3 hot = zoneColor(t + 0.24 + heat * 0.08, vec3(0.58, 1.00, 0.14), 0.44, 1.34);
  vec3 violet = zoneColor(t + 0.58, vec3(0.85, 0.24, 1.00), 0.34, 1.26);
  return mix(mix(cold, hot, heat * 0.55), violet, 0.18 + heat * 0.14);
}

vec4 mandelbrotField(vec2 uv, float time, float zoom, float audioMorph, float audioDetail, float audioPulse) {
  vec2 center = vec2(-0.62, 0.36);
  center += 0.035 * vec2(
    sin(time * 0.071 + audioMorph * 1.7),
    cos(time * 0.063 + audioMorph * 1.3)
  );

  vec2 c = center + uv * max(0.35, zoom);
  vec2 z = vec2(0.0);
  float iter = float(MANDEL_MAX_ITER);
  float escaped = 0.0;
  float trapLine = 10.0;
  float trapRing = 10.0;
  float trapPoint = 10.0;
  float r2 = 0.0;

  for (int i = 0; i < MANDEL_MAX_ITER; i++) {
    z = complexSquare(z) + c;
    r2 = dot(z, z);

    float lineD = abs(z.x * 0.75 + z.y * 0.35);
    trapLine = min(trapLine, lineD);

    float ringRadius = mix(0.18, 0.36, 0.5 + 0.5 * sin(time * 0.20 + audioMorph));
    float ringD = abs(length(z) - ringRadius);
    trapRing = min(trapRing, ringD);

    vec2 trapP = 0.22 * vec2(sin(time * 0.17), cos(time * 0.13));
    trapPoint = min(trapPoint, length(z - trapP));

    if (r2 > 4.0 && escaped < 0.5) {
      iter = float(i);
      escaped = 1.0;
      break;
    }
  }

  float smoothIter = iter;
  if (escaped > 0.5) {
    float logZn = 0.5 * log(max(r2, 1e-6));
    float nu = safeLog2(logZn / log(2.0));
    smoothIter = iter + 1.0 - nu;
  }

  float normIter = clamp(smoothIter / float(MANDEL_MAX_ITER), 0.0, 1.0);
  float lineMask = 1.0 - smoothstep(0.004, 0.045 + audioDetail * 0.025, trapLine);
  float ringMask = 1.0 - smoothstep(0.004, 0.035 + audioDetail * 0.020, trapRing);
  float pointMask = 1.0 - smoothstep(0.004, 0.030 + audioPulse * 0.020, trapPoint);
  float boundary = smoothstep(0.18, 0.95, normIter) * escaped;
  float inside = 1.0 - escaped;
  float trapCombined = clamp(lineMask * 0.55 + ringMask * 0.35 + pointMask * 0.45, 0.0, 1.0);

  return vec4(normIter, trapCombined, boundary, inside);
}

// ── Tunnel / portal depth helpers (Stage 11) ──────────────────────────────────
// Polar log-depth coordinates: r close to 0 → "infinity", r large → near rim.
// Spiral applied as UV rotation BEFORE polar conversion so the atan branch cut
// never appears inside the depth accumulator (which feeds sin() downstream).
vec3 tunnelCoords(vec2 p, float t, float inward, float spiral) {
  float spinAngle = spiral * length(p) * 0.40 + t * spiral * 0.10;
  float cs = cos(spinAngle), sn = sin(spinAngle);
  vec2 sp = vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y);
  float r = max(length(sp), 0.0015);
  float theta = atan(sp.y, sp.x);
  float depth = -log(r) + t * (0.18 + inward * 0.42);
  return vec3(r, theta, depth);
}

// Gill ridges: integer sector count keeps sin() continuous across the
// atan branch cut; depth-attenuated so they fade into the far field.
float gillRidges(float theta, float depth, float density) {
  float sectors = floor(4.0 + density * 8.0 + 0.5);
  float gillPhase = theta * sectors + depth * 0.55;
  float band = 0.5 + 0.5 * sin(gillPhase);
  band = pow(band, mix(2.6, 1.5, density));
  return band * exp(-max(depth, 0.0) * 0.16) * density;
}

float growthWaveBand(float r, float age, float amp, float width) {
  float waveR = mix(0.10, 1.08, clamp(age, 0.0, 1.0));
  float wave = exp(-pow((r - waveR) / max(width, 0.001), 2.0));
  return wave * amp * (1.0 - smoothstep(0.92, 1.0, age));
}

// Composite tunnel field: concentric depth rings × gill ridges × breath pulse.
// Returns intensity scalar; caller tints with palette.
float tunnelLayer(vec3 polar, float gills, float breath, float spiral, float t) {
  float r = polar.x;
  float theta = polar.y;
  float depth = polar.z;
  float ringPhase = depth * (2.2 + spiral * 1.10);
  float rings = 0.5 + 0.5 * sin(ringPhase);
  rings = pow(rings, 2.3);
  float breathPhase = sin(t * 0.42 + depth * 0.55);
  rings *= 1.0 + breath * 0.34 * breathPhase;
  float ridges = gillRidges(theta, depth, gills);
  float membraneSectors = floor(10.0 + gills * 6.0 + 0.5);
  float membranes = pow(0.5 + 0.5 * cos(theta * membraneSectors - depth * (0.72 + spiral * 0.48)), 3.0) * gills;
  float spiralRibs = pow(0.5 + 0.5 * sin(depth * (3.4 + spiral * 1.8) + theta * (2.0 + spiral * 4.0)), 2.1)
                   * (0.20 + spiral * 0.42);
  float radialFalloff = smoothstep(0.04, 1.30, r) * (1.0 - smoothstep(1.35, 2.10, r));
  return clamp(rings * 0.38 + ridges * 0.50 + membranes * 0.22 + spiralRibs * 0.16, 0.0, 1.75) * radialFalloff;
}

// Portal bloom: narrow concentric ring at a target radius. Onset-gated, decays
// quickly in the JS smoothing so it can't dominate the frame.
float portalBloom(vec3 polar, float bloom) {
  float band = exp(-pow((polar.x - 0.46) * 5.8, 2.0));
  float throat = exp(-pow(polar.x * 3.4, 2.0));
  return (band * 0.86 + throat * 0.16) * bloom;
}

// ── SDF: organic blob ──────────────────────────────────────────────────────────
// tBase param is the slow evolution time used for the ambient breathing term
float sdfBlob(vec3 p, float t, float tBase, float bass, float mid, float chaos) {
  // Domain-warp magnitude: clamp the audio-driven contribution so peaks can't
  // blow the SDF surface. uAudioTurbulence owns warp magnitude per the role
  // table; uLowMid stays at a tiny floor for low-end body coupling.
  float warpAudio = clamp(uAudioTurbulence * 0.35 + uLowMid * 0.12, 0.0, 0.32);
  float warp = chaos * (0.92 + uSurfaceEnergy * 0.32) + 0.28 + warpAudio + uBassPulse * 0.045;
  vec3 q = p + warp * 0.30 * vec3(
    sin(p.y * 1.85 + t * 1.0) + cos(p.z * 1.48 + t * 0.72),
    cos(p.x * 1.72 + t * 0.64) + sin(p.z * 2.04 + t * 1.04),
    sin(p.x * 1.36 + t * 0.80) + cos(p.y * 2.34 + t * 0.54)
  );
  float coreFlow = fbm3(q * (0.72 + uRms * 0.08) + tBase * 0.08) * (0.18 + uCoreEnergy * 0.22 + uBassPulse * 0.04);
  float surfaceFlow = fbm3(q * (1.18 + uSurfaceEnergy * 0.28 + uHighMid * 0.08) + t * 0.13) * (0.085 + mid * 0.13 + uLowMid * 0.055 + uSurfaceEnergy * 0.12);
  float disp = coreFlow + surfaceFlow + uBassMid * 0.060 + uMidPulse * 0.024;

  // Gill ridges: integer radial sector count around local Y axis. Integer count
  // avoids the atan branch-cut seam (see shaders.md §Common bugs). Underside-
  // biased so the mushroom underside carries the gill detail.
  int   gillCount = 12;
  float gillAngle = atan(q.z, q.x);
  float gills     = pow(sin(gillAngle * float(gillCount) + tBase * 0.4) * 0.5 + 0.5, 2.25);
  float underBias = smoothstep(0.16, -0.48, q.y);
  float membraneWave = growthWaveBand(length(q.xz), uTunnelB.z, uTunnelB.w, 0.135);
  float gillAmt   = (0.034 + uAudioMorph * 0.034 + uAudioDetail * 0.016 + membraneWave * 0.026) * underBias;

  // Asymmetric cap displacement: slow off-axis lobe so the form doesn't feel
  // like a perfect mandala.
  float capLobe = sin(q.x * 1.3 + tBase * 0.21) * cos(q.z * 1.1 - tBase * 0.17)
                * 0.025 * (1.0 + uAudioMorph * 0.4);

  // Mycelium displacement on skin (cheap 2D cellularEdge on q.xy).
  float myc    = cellularEdge(q.xy * 1.7 + vec2(tBase * 0.05, -tBase * 0.04), tBase * 0.18);
  float mycAmt = 0.010 + uAudioDetail * 0.012;

  disp += gills * gillAmt + capLobe + myc * mycAmt + membraneWave * (0.018 + underBias * 0.030);

  // Two incommensurate sinusoids ensure the orb is always alive at silence
  float breath = sin(tBase * 0.7) * 0.015 + sin(tBase * 0.31) * 0.008 + uTunnelB.x * 0.010;
  float capBias = smoothstep(-0.20, 0.44, q.y);
  float stemBias = smoothstep(-0.06, -0.72, q.y);
  vec3 qShape = q;
  qShape.xz *= mix(1.0, 0.86, capBias);
  qShape.xz *= 1.0 + stemBias * 0.30;
  qShape.y *= mix(1.0, 1.20, capBias);
  qShape.y *= mix(1.0, 0.92, stemBias);
  return (length(qShape) - (0.66 + uCoreEnergy * 0.17 + bass * 0.075 + uBassPulse * 0.035 + disp + breath)) * 0.70;
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
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
  return smin(smin(d0, d1, 0.28), d2, 0.28);
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
  float organicTunnel = clamp(uEngineA.x, 0.0, 1.0);
  float liquidMandala = clamp(uEngineA.y, 0.0, 1.0);
  float neuralBloom = clamp(uEngineA.z, 0.0, 1.0);
  float myceliumPulse = clamp(uEngineA.w, 0.0, 1.0);
  float plasmaCreature = clamp(uEngineB.x, 0.0, 1.0);
  audioPresence = clamp(max(audioPresence, uEngineB.y), 0.0, 1.0);
  float journeyIntensity = clamp(uEngineB.z, 0.0, 1.0);
  float calmMotion = clamp(uEngineB.w, 0.0, 1.0);
  float bloomEnergy = clamp(uEngineC.x, 0.0, 1.0);
  float warpDepth = clamp(uEngineC.y, 0.0, 1.0);
  float atmosphereDensity = clamp(uEngineC.z, 0.0, 1.0);
  float engineSurfaceDetail = clamp(uEngineC.w, 0.0, 1.0);
  float tunnelPull = clamp(uEngineD.x, 0.0, 1.0);
  float trailPersistence = clamp(uEngineD.y, 0.0, 1.0);
  float particleActivity = clamp(uEngineD.z, 0.0, 1.0);
  float onsetAccent = clamp(uEngineD.w, 0.0, 1.0);
  float growthAge = clamp(uTunnelB.z, 0.0, 1.0);
  float growthAmp = clamp(uTunnelB.w, 0.0, 1.0);
  float afterglowSoft = smoothstep(0.52, 0.92, uSilence) * smoothstep(0.10, 0.55, trailPersistence);
  float phaseHeat = clamp(uPaletteShift * 0.60 + bloomEnergy * 0.38 + growthAmp * 0.32, 0.0, 1.0);
  float baseCycle = uPalettePhase * mix(0.36, 0.18, afterglowSoft) + uColorShift * 0.08;
  float layerCycle = baseCycle + sin(uTime * 0.011 + uBeatPhase * TAU) * 0.035;
  float shimmerCycle = uTime * mix(0.10, 0.045, afterglowSoft) + uPalettePhase * 0.33 + uTreblePulse * 0.16;

  vec2 fieldUV = warpField(sUV, tBase, tDetail);
  float fieldDetail = 0.5 + 0.5 * fbm(fieldUV * 0.46 + vec2(tBase * 0.030, -tBase * 0.024));
  float modeBias = (fieldDetail - 0.5) * (0.32 + uModeBlend.x * 0.20 + uModeBlend.y * 0.16 + uModeBlend.w * 0.14);
  float asymmetryGate = clamp(1.0 - modeRadial * 0.45, 0.35, 1.0);
  vec2 organicAsym = fbm2(
    fieldUV * (0.34 + uAudioMorph * 0.08)
    + vec2(tBase * 0.021 + uCamDrift.x * 0.80, -tBase * 0.017 + uCamDrift.y * 0.80)
    + uMouse * 0.08
  );
  float asymPhase = dot(organicAsym, vec2(1.7, -1.2)) + modeBias * 0.70 + uCamDrift.x * 0.35 - uCamDrift.y * 0.28;
  float asymStrength = (0.012 + uAudioMorph * 0.014 + uAudioTurbulence * 0.010 + abs(modeBias) * 0.020) * asymmetryGate;
  fieldUV += organicAsym * asymStrength;
  float centerFalloff = 1.0 - smoothstep(0.08, 1.95, length(fieldUV));
  vec2 radialDir = normalize(fieldUV + vec2(0.0001));
  fieldUV -= radialDir * tunnelPull * (0.010 + organicTunnel * 0.018 + calmMotion * 0.006) * centerFalloff;
  fieldUV += fbm2(fieldUV * (0.66 + neuralBloom * 0.28) + organicAsym * 0.22 + vec2(tBase * 0.014, -tBase * 0.017))
           * bloomEnergy * neuralBloom * 0.018;

  float spiralAmount = (0.026 + uAudioMorph * 0.060 + uAudioPulse * 0.030 + uAudioTurbulence * 0.030)
                     * (0.32 + modeFluid * 0.28 + modeRadial * 0.30 + modeVortex * 1.35 + modeCollapse * 0.42 + modeOrbit * 0.46)
                     * (0.82 + warpDepth * 0.36 + neuralBloom * bloomEnergy * 0.18)
                     * mix(0.48, 1.0, audioPresence);
  fieldUV = spiralWarp(fieldUV, spiralAmount, tBase * (0.40 + modeVortex * 0.32) + uAudioTurbulence * 1.35 + modeBias * 0.45 + asymPhase * 0.10);

  float foldSectorsRaw = 4.35 + modeRadial * 2.85 + modeOrbit * 0.95 + modeCollapse * 0.35 + liquidMandala * 0.70 + asymPhase * 0.28;
  float foldSectors = floor(clamp(foldSectorsRaw, 3.0, 8.0) + 0.5);
  float foldPhase = tBase * (0.16 + modeVortex * 0.22 + modeOrbit * 0.28)
                  + uAudioPulse * 0.05 + modeOrbit * 2.094 + liquidMandala * 0.24 + asymPhase * 0.18 + uMouse.x * 0.06;
  float kaleidoMix = (0.006 + modeFluid * 0.003 + modeRadial * 0.095 + modeVortex * 0.032 + modeCollapse * 0.014 + modeOrbit * 0.046)
                   * (0.54 + audioPresence * 0.36 + uAudioMorph * 0.12 + liquidMandala * 0.16);
  float foldAmount = clamp(0.74 + modeRadial * 0.18 + modeOrbit * 0.10 + uAudioPulse * 0.03, 0.0, 0.98);
  vec2 foldedUV = kaleidoFold(fieldUV, foldSectors, foldPhase, foldAmount);
  fieldUV = mix(fieldUV, foldedUV, kaleidoMix);
  fieldUV += organicAsym.yx * vec2(0.006, -0.005) * (1.0 - modeRadial * 0.55 + uAudioTurbulence * 0.35);

  float collapsePull = modeCollapse * (0.024 + uAudioBody * 0.050 + uAudioPulse * 0.026 + myceliumPulse * bloomEnergy * 0.020)
                     * (1.0 - smoothstep(0.18, 1.80, length(fieldUV)));
  fieldUV *= 1.0 - collapsePull;

  vec2 orbitOffset = vec2(cos(foldPhase), sin(foldPhase)) * (0.018 + uAudioMorph * 0.018 + plasmaCreature * particleActivity * 0.010) * modeOrbit;
  vec2 orbitSeed = fieldUV + orbitOffset + organicAsym * (0.010 + uAudioMorph * 0.006) * modeOrbit;
  vec2 orbitFold = kaleidoFold(orbitSeed, 3.0, foldPhase * 0.55 + asymPhase * 0.11, 0.78) - orbitOffset;
  fieldUV = mix(fieldUV, orbitFold, modeOrbit * (0.018 + uAudioMorph * 0.026 + plasmaCreature * 0.012));

  vec2 fieldNdc = fieldUV / vec2(aspect, 1.0);
  sUV = fieldUV;

  // ── Mandala / radial influence layer ──────────────────────────────────────
  // Biases the FBM warp toward radial direction during peak/break. Never perfect.
  float radialBias = uEnergy * smoothstep(0.3, 0.85, uEnergy) * uPaletteShift * 0.45
                   + uCoreEnergy * smoothstep(0.3, 1.0, uCoreEnergy) * 0.10
                   + uModeBlend.x * 0.16
                   + liquidMandala * (0.030 + bloomEnergy * 0.045)
                   + uBassPulse * 0.035
                   + modeBias * 0.08;
  // Integer sectorCount: keeps sin(radialAngle * N) continuous across the atan2 branch cut.
  // Non-integer N here produces a visible horizontal seam on the negative-x axis.
  float sectorCount = floor(5.0 + sin(uTime * 0.07) * 1.4 + 0.5);
  vec2  radialP     = fieldNdc;
  float radialAngle = atan(radialP.y, radialP.x);
  float mandalaWarp = sin(radialAngle * sectorCount + uTime * 0.3 + organicAsym.x * 0.35) * radialBias * (0.052 + modeRadial * 0.010 + liquidMandala * 0.006);
  sUV += normalize(radialP + vec2(0.0001)) * mandalaWarp;

  float smoothSpin = (uModeBlend.y * (0.075 + uCoreEnergy * 0.20 + modeBias * 0.06 + neuralBloom * bloomEnergy * 0.08)) * (1.0 - smoothstep(0.0, 1.8, length(sUV)));
  float smoothSpinAngle = atan(sUV.y + organicAsym.y * 0.018, sUV.x + organicAsym.x * 0.018) + smoothSpin + asymPhase * 0.035;
  vec2 spunUV = vec2(cos(smoothSpinAngle), sin(smoothSpinAngle)) * length(sUV + organicAsym * 0.010);
  sUV = mix(sUV, spunUV + organicAsym * 0.012 * modeVortex, uModeBlend.y * 0.14);

  // ── Virtual camera ─────────────────────────────────────────────────────────
  vec3 ro, rd;

  if (uMode == 0) {
    // Fluid: orbit camera outside the blob
    float orbit = t * (0.50 + organicTunnel * 0.08) + uSub * 0.55 + tunnelPull * 0.18;
    float tilt  = cos(t * 0.30) * (0.48 + calmMotion * 0.08) + sin(t * 0.13) * 0.18;
    float dist  = mix(2.8, uCameraDistance, 0.45) - uCoreEnergy * 0.17 - tunnelPull * 0.09;

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
    float a2d   = atan(sUV.y, sUV.x) + uTime * uSpeed * (0.052 + liquidMandala * 0.020);
    vec2  sUV2  = vec2(cos(a2d), sin(a2d)) * r2d * (1.0 - uSub * 0.08);

    float orbit2 = t * 0.80 + uSub * 0.6;
    float dist2  = mix(1.2, uCameraDistance, 0.45) - uCoreEnergy * 0.12;
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
    float vortexAngle = tBase * (0.58 + neuralBloom * 0.14) + (uSub + uBass) * 0.95 + bloomEnergy * 0.45;
    float r2d   = length(sUV);
    // Spiral: rotate UV by an angle that increases toward center
    float spinAmount = (uSub * 0.4 + uBass * 0.6) * 0.54 + tBase * 0.05 + neuralBloom * bloomEnergy * 0.20;
    float a2d   = atan(sUV.y, sUV.x) + spinAmount * (1.0 - smoothstep(0.0, 1.8, r2d));
    vec2  sUV2  = vec2(cos(a2d), sin(a2d)) * r2d;

    float orbit = vortexAngle;
    float dist  = mix(2.2, uCameraDistance, 0.45) - uCoreEnergy * 0.18;
    ro = vec3(sin(orbit) * dist + uCamDrift.x, cos(t * 0.22) * 0.7 + uMouse.y * 0.5, cos(orbit) * dist + uCamDrift.y);
    vec3 fwd     = normalize(-ro + vec3(uMouse.x * 0.3, 0.0, 0.0));
    vec3 worldUp = abs(fwd.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 right   = normalize(cross(fwd, worldUp));
    vec3 up      = cross(right, fwd);
    rd = normalize(fwd + sUV2.x * right * 0.70 + sUV2.y * up * 0.70);

  } else if (uMode == 3) {
    // Collapse: ray origin oscillates inward on bass kick, outward on mid
    float collapseZ = mix(2.4, uCameraDistance, 0.45) - uCoreEnergy * 0.20 + uSurfaceEnergy * 0.20 - myceliumPulse * bloomEnergy * 0.06;
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
    float orbit = t * (0.46 + plasmaCreature * 0.08) + uSub * 0.48 + particleActivity * 0.12;
    float tilt  = cos(t * 0.27) * 0.50 + sin(t * 0.15) * 0.15;
    float dist  = mix(3.0, uCameraDistance, 0.45) - uCoreEnergy * 0.16;
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
    tRay += max(abs(d) * 0.45, 0.008);
    if (tRay > maxDist) break;
  }

  if (hitDist > 0.0) {
    for (int i = 0; i < 3; i++) {
      vec3 p = ro + rd * hitDist;
      float d;
      if (uMode == 4) {
        d = sdfOrbit(p, tJitter, tBase, uBass, uMid, uChaos);
      } else {
        float collapseMod = uMode == 3 ? (uBass - uMid) * 0.20 : 0.0;
        d = sdfBlob(p, tJitter, tBase, uBass + collapseMod, uMid, uChaos);
      }
      hitDist = clamp(hitDist + d * 0.72, 0.08, maxDist);
      minD = min(minD, abs(d));
    }
  }

  // depth01: 0 = close foreground, 1 = far background / miss
  float depth01   = clamp(tRay / maxDist, 0.0, 1.0);
  float depthFog  = 1.0 - exp(-tRay * 0.032);
  float edgeProximity = exp(-minD * minD * 5.5);
  float edgeFeather = smoothstep(0.10, 0.92, edgeProximity);
  float audioAtmosphere = smoothstep(0.16, 0.72, uEnergy + onsetAccent * 0.22 + uTreblePulse * 0.12 + uAudioBrightness * 0.18 + atmosphereDensity * 0.14);
  // Atmospheric fog color: dark violet/black-green anchor so neon accents stay luminous.
  vec3  fogColor  = deepColor(layerCycle + fieldDetail * 0.08, vec3(0.010, 0.040, 0.060))
                  * (0.075 + fieldDetail * 0.020 + afterglowSoft * 0.018);
  float atmosphereLift = mix(0.58, 1.0, audioPresence) * (0.64 + audioAtmosphere * 0.26 + atmosphereDensity * 0.16 + calmMotion * 0.08);
  vec2 atmosphereFlow = organicAsym * 0.16
                      + vec2(sin(tBase * 0.12 + modeBias), cos(tBase * 0.10 - modeBias)) * 0.10
                      + uCamDrift * 0.05;
  float vaporBroad = 0.5 + 0.5 * fbm(fieldUV * 0.31 + atmosphereFlow + vec2(tBase * 0.018, -tBase * 0.014));
  float vaporFine = 0.5 + 0.5 * noise(fieldUV * 0.82 + atmosphereFlow.yx * 0.35 + vec2(-tBase * 0.025, tBase * 0.020));
  float vaporMist = smoothstep(0.24, 0.90, mix(vaporBroad, vaporFine, 0.22));
  float screenHazeMask = 1.0 - smoothstep(1.02, 1.72, length(vUv * 2.0 - 1.0));
  float depthHaze = smoothstep(0.12, 0.82, depth01) * screenHazeMask;

  // Shared field sample: same FBM used by background — hoisted so blob surface
  // can tint from it, knitting the two layers into one continuous field.
  vec2 bgFlow = vec2(
    sin(t * 0.04 + fieldUV.y * 0.65) * 0.18,
    cos(t * 0.035 + fieldUV.x * 0.55) * 0.14
  ) + vec2(uLowMid * 0.025, -uBassPulse * 0.018);
  float bgN = fbm(fieldUV * 0.42 + bgFlow + vec2(uPalettePhase * 0.05, -uPalettePhase * 0.03));

  vec3 col = vec3(0.0);
  float silhouetteSoft = 0.0;

  if (hitDist > 0.0) {
    // ── Surface: diffuse volume + gated detail ──────────────────────────────
    vec3  p    = ro + rd * hitDist;
    vec3  nrm  = calcNormal(p, tJitter, tBase, uBass, uMid, uChaos, uMode);
    vec3  lDir  = normalize(vec3(sin(t * 0.35) * 1.2, 0.8, cos(t * 0.35) * 1.2));
    vec3  lFill = normalize(vec3(-sin(t * 0.27) * 0.9, -0.55, -cos(t * 0.27) * 0.9));
    float wrapKey  = dot(nrm, lDir)  * 0.5 + 0.5;
    float wrapFill = dot(nrm, lFill) * 0.5 + 0.5;
    float diff = wrapKey * 0.46 + wrapFill * 0.20 + 0.075 + uCoreEnergy * 0.085;

    // t driven by value + energy + depth: foreground/high-energy → magenta/cyan
    float noiseV  = fbm3(p * 0.55 + t * 0.08);
    float surfaceDetail = fbm3(p * (2.0 + uSurfaceEnergy * 1.2 + uHighMid * 0.7 + engineSurfaceDetail * 0.34) + tDetail * (0.14 + uTreble * 0.030 + journeyIntensity * 0.030));
    surfaceDetail *= 0.85 + (bgN - 0.5) * 0.30;
    float surfDepth = clamp(hitDist / maxDist, 0.0, 1.0);
    float viewSoft = pow(1.0 - clamp(dot(nrm, -rd), 0.0, 1.0), 2.15);
    float grazingSoft = smoothstep(0.34, 0.92, viewSoft);
    silhouetteSoft = grazingSoft;
    float interiorDetailMask = 1.0 - grazingSoft * 0.72;
    float capZone = smoothstep(-0.18, 0.46, p.y);
    float undersideZone = smoothstep(0.12, -0.52, p.y);
    float rimZone = smoothstep(0.22, 0.86, length(p.xz)) * (1.0 - smoothstep(0.95, 1.34, length(p.xz)));
    float growthSurfaceWave = growthWaveBand(length(p.xz), growthAge, growthAmp, 0.150) * interiorDetailMask;
    float materialZones = (capZone - undersideZone) * 0.10 + (surfaceDetail - 0.5) * 0.16 + (bgN - 0.5) * 0.12;
    float coolBaseBias = (1.0 - smoothstep(0.12, 0.78, uEnergy)) * 0.34;
    float ct      = noiseV * 0.25 + uEnergy * 0.30 + (1.0 - surfDepth) * 0.25
                  + uPaletteShift * 0.14 + uColorShift * 0.25 + uMidHi * 0.08
                  + surfaceDetail * interiorDetailMask * (uSurfaceEnergy * 0.10 + uMidPulse * 0.03)
                  + uSpectralCentroid * 0.04 + uAudioBrightness * 0.07 + uAudioMorph * 0.04
                  + liquidMandala * 0.025 + neuralBloom * bloomEnergy * 0.035 + plasmaCreature * particleActivity * 0.020;
    ct += (bgN - 0.5) * (0.10 + uAudioMorph * 0.06);
    ct += materialZones + coolBaseBias + layerCycle * 0.42;

    vec3 violetFlesh = saturateNeon(
      mix(vec3(0.12, 0.035, 0.34), vec3(0.45, 0.10, 0.78), 0.42 + surfaceDetail * 0.26 + capZone * 0.12),
      1.34 + phaseHeat * 0.10
    );
    vec3 roseEmission = zoneColor(ct + 0.20, vec3(1.00, 0.13, 0.56), 0.54, 1.36);
    vec3 fleshCol = mix(violetFlesh, roseEmission, clamp(0.07 + phaseHeat * 0.12 + capZone * 0.04 + growthSurfaceWave * 0.08 - afterglowSoft * 0.14, 0.03, 0.28));
    vec3 foldCol = deepColor(ct + 0.30, vec3(0.018, 0.012, 0.105)) * 0.82;
    vec3 membraneCol = zoneColor(ct + 0.17 + shimmerCycle * 0.045, vec3(1.00, 0.48, 0.10), 0.42 + phaseHeat * 0.18, 1.40);
    vec3 acidAccent = zoneColor(ct + 0.48 + shimmerCycle * 0.075, vec3(0.58, 1.00, 0.12), 0.52, 1.48);
    vec3 coolMembrane = zoneColor(ct + 0.62 + layerCycle * 0.18, vec3(0.02, 0.78, 0.92), 0.48, 1.24);
    vec3 surfaceBase = mix(fleshCol, foldCol, undersideZone * 0.55 + viewSoft * 0.32);
    surfaceBase = mix(surfaceBase, membraneCol, capZone * growthSurfaceWave * 0.36);

    col  = surfaceBase * diff * 0.86;
    col += mix(violetFlesh, coolMembrane, 0.34) * interiorDetailMask * (0.145 + audioPresence * 0.105 + uAudioBody * 0.050 + calmMotion * 0.030);
    col += membraneCol * surfaceDetail * interiorDetailMask * (uSurfaceEnergy * 0.13 + uHighMid * 0.040 + engineSurfaceDetail * 0.020);
    col += acidAccent * growthSurfaceWave * (0.055 + phaseHeat * 0.040) * (0.35 + rimZone);
    col += foldCol * undersideZone * (0.028 + uAudioMorph * 0.020);
    col += zoneColor(ct + 0.35, vec3(0.14, 0.75, 1.00), 0.34, 1.24) * viewSoft * (0.016 + uHi * 0.010 + audioAtmosphere * 0.006) * (1.0 - surfDepth * 0.42) * interiorDetailMask;
    float surfaceEdgeFill = smoothstep(0.12, 0.80, viewSoft) * edgeFeather;
    col += acidAccent * surfaceEdgeFill * (0.010 + uCoreEnergy * 0.008 + audioAtmosphere * 0.003 + growthAmp * 0.012) * (1.0 - surfDepth * 0.35);
    col += deepColor(ct + 0.56, vec3(0.02, 0.05, 0.10)) * 0.030;
    col += uCoreEnergy * membraneCol * 0.045;

    float surfaceGillAngle = atan(p.z, p.x);
    float surfaceGills = pow(sin(surfaceGillAngle * 12.0 + tBase * 0.40) * 0.5 + 0.5, 2.1);
    float capGillMask = capZone * rimZone * (1.0 - smoothstep(0.18, 0.90, viewSoft)) * 0.68;
    float surfaceGillMask = clamp(undersideZone + capGillMask, 0.0, 1.0) * interiorDetailMask * (1.0 - smoothstep(0.10, 0.86, viewSoft));
    float gillOpen = smoothstep(0.08, 0.74, uAudioMorph + uMidPulse * 0.30 + growthAmp * 0.42);
    float gillCrease = (1.0 - surfaceGills) * surfaceGillMask * gillOpen * (0.18 + uAudioMorph * 0.18 + growthSurfaceWave * 0.20);
    col *= 1.0 - clamp(gillCrease, 0.0, 0.38);
    float surfaceGillAmp = (0.030 + uAudioMorph * 0.046 + uAudioDetail * 0.024 + growthSurfaceWave * 0.070) * surfaceGillMask;
    vec3 gillCol = mix(membraneCol, acidAccent, surfaceGills * (0.36 + gillOpen * 0.34));
    col += gillCol * surfaceGills * surfaceGillAmp;

    vec2 mandelGillUV = vec2(
      surfaceGillAngle / TAU,
      p.y * 0.65 + length(p.xz) * 0.35
    ) * 2.0 - 1.0;
    mandelGillUV.x *= 1.6;
    mandelGillUV += organicAsym * 0.035;
    mandelGillUV = rot2(0.05 * sin(uTime * 0.09) + 0.10 * uAudioMorph) * mandelGillUV;
    vec4 gillMandel = mandelbrotField(
      mandelGillUV,
      uTime * mix(0.54, 0.34, afterglowSoft) + 11.0,
      mix(1.16, 0.68, clamp(uAudioMorph * 0.75 + gillOpen * 0.25, 0.0, 1.0)),
      uAudioMorph,
      uAudioDetail,
      uAudioPulse + growthAmp * 0.35
    );
    float fractalGillZone = clamp(undersideZone * 0.82 + rimZone * (1.0 - capZone) * 0.34, 0.0, 1.0);
    float fractalGillMask = surfaceGillMask * fractalGillZone * (0.18 + gillOpen * 0.72);
    float fractalGillRibs = gillMandel.y * fractalGillMask;
    float fractalVeinGlow = gillMandel.z * fractalGillMask;
    float fractalDarkFold = gillMandel.w * fractalGillMask * (0.11 + undersideZone * 0.10);
    vec3 mandelGillCol = mandelPalette(gillMandel.x + ct * 0.12 + layerCycle * 0.18, phaseHeat + uSpectralCentroid * 0.16);
    col = mix(col, col * 0.62, clamp(fractalDarkFold, 0.0, 0.24));
    col += mandelGillCol * fractalGillRibs * (0.040 + uAudioDetail * 0.066 + growthAmp * 0.030);
    col += mix(coolMembrane, acidAccent, 0.34 + phaseHeat * 0.20) * fractalVeinGlow * (0.028 + uAudioPulse * 0.058 + uAudioBrightness * 0.024);

    // Mycelium on the core surface: cellularEdge sampled in surface space,
    // driven by morph/detail/turbulence audio signals. Reads as carved
    // biological vein texture, not an overlay.
    const float CORE_VEIN_SCALE = 1.6;
    const float CORE_VEIN_MORPH_SCALE = 0.6;
    vec2  coreVeinUV  = fieldUV * (CORE_VEIN_SCALE + uAudioMorph * CORE_VEIN_MORPH_SCALE) + vec2(tBase * 0.06, -tBase * 0.04);
    float coreVein    = cellularEdge(coreVeinUV, tBase * 0.22 + uPalettePhase * 0.10);
    float coreVeinAmp = (0.034 + uAudioDetail * 0.090 + uAudioTurbulence * 0.046) * interiorDetailMask;
    col += mix(acidAccent, zoneColor(ct + 0.42, vec3(1.0, 0.78, 0.14), 0.50, 1.44), coreVein * phaseHeat) * coreVein * coreVeinAmp;

    // Inner glow at grazing angles: light leaking through translucent
    // membrane, brighter on body audio + brightness.
    float innerGlow = pow(grazingSoft, 1.4) * (0.030 + uAudioBody * 0.045 + uAudioBrightness * 0.035);
    col += mix(membraneCol, acidAccent, growthSurfaceWave * 0.55 + uAudioBrightness * 0.16) * innerGlow * (1.0 - surfDepth * 0.30);
    float coolMembraneMask = clamp(
      (0.16 + undersideZone * 0.24 + (1.0 - capZone) * 0.10 + surfaceDetail * 0.18 + growthSurfaceWave * 0.10)
      * (1.0 - phaseHeat * 0.16),
      0.0,
      0.38
    );
    col = mix(col, coolMembrane * (0.24 + diff * 0.62), coolMembraneMask);

    col *= (1.0 - surfDepth * 0.15);
    // Edge erosion: silhouette feathered by mutation noise so it doesn't read
    // as a clean smooth circle. Replaces the prior uniform grazing→fog mix.
    float erodeMask = fbm(p.xy * 4.5 + vec2(tBase * 0.07, 0.0));
    float erodeBlend = grazingSoft * (0.23 + audioAtmosphere * 0.08) * (1.0 - surfDepth * 0.18)
                     * (0.55 + erodeMask * 0.45);
    col = mix(col, fogColor, erodeBlend);
    // Atmospheric fog: blend toward near-black at depth
    col  = mix(col, fogColor, smoothstep(0.3, 0.9, surfDepth));

  } else {
    // ── Volumetric glow: near-miss rays accumulate fog ───────────────────────
    // Glow stronger in foreground (small depth01), fades at back
    float glowStr = mix(0.13, 0.07, depth01) * (0.92 + atmosphereDensity * 0.16);
    float glow    = exp(-minD * 0.95) * glowStr * (0.085 + audioAtmosphere * 0.12 + uCoreEnergy * 0.045 + calmMotion * 0.010);
    float bgT = bgN * 0.36 + 0.72 + uColorShift * 0.3 + uAudioBrightness * 0.04;
    vec3 bgFog = deepColor(bgT + layerCycle + fieldDetail * 0.06, vec3(0.00, 0.11, 0.15)) * (0.15 + bgN * 0.080 + fieldDetail * 0.030 + uCoreEnergy * 0.025);
    vec3 bgGlowCol = zoneColor(bgT + layerCycle * 0.55, vec3(0.02, 0.80, 0.95), 0.42, 1.18);
    col  = bgGlowCol * glow * (0.18 + uCoreEnergy * 0.18);
    col += bgFog;
    col *= (1.0 - depthFog * 0.34);
    col += zoneColor(bgT + 0.30 + layerCycle * 0.30, vec3(0.16, 0.06, 0.45), 0.36, 1.16) * depthFog * 0.024 * (0.4 + uCoreEnergy * 0.16 + atmosphereDensity * 0.08);
    col  = mix(col, fogColor, smoothstep(0.5, 1.0, depth01));
  }

  // ── Tunnel / portal depth layer (Stage 11) ──────────────────────────────────
  // Polar field composited behind the SDF surface. Reads as inward travel —
  // concentric depth rings + radial gill ridges + breathing pulse. Driven per
  // mode by uTunnelA / uTunnelB; gated by audio presence so silence stays calm.
  // Starts from stable screen UV, then lightly couples to the shared warped
  // field basis before polar conversion so the seam-safe tunnel breathes with
  // the organism without becoming another crawling surface warp.
  vec2 rawTunnelUV = (vUv * 2.0 - 1.0) * vec2(aspect, 1.0);
  rawTunnelUV += organicAsym * 0.045 + uCamDrift * 0.12;
  const float COORD_COUPLE = 0.18;
  vec2 tunnelUV = mix(rawTunnelUV, fieldUV, COORD_COUPLE);
  float tunDepth   = clamp(uTunnelA.x, 0.0, 1.0);
  float tunInward  = clamp(uTunnelA.y, 0.0, 1.0);
  float tunGills   = clamp(uTunnelA.z, 0.0, 1.0);
  float tunSpiral  = clamp(uTunnelA.w, 0.0, 1.0);
  float tunBreath  = clamp(uTunnelB.x, 0.0, 1.0);
  float tunPortal  = clamp(uTunnelB.y, 0.0, 1.0);
  vec3 polarT = tunnelCoords(tunnelUV, tBase, tunInward, tunSpiral);
  float tunnelI = tunnelLayer(polarT, tunGills, tunBreath, tunSpiral, tBase);
  float portalI = portalBloom(polarT, tunPortal);
  float portalMask = (1.0 - smoothstep(0.10, 0.78, polarT.x)) * smoothstep(0.015, 0.20, polarT.x);
  vec2 mandelPortalUV = tunnelUV;
  mandelPortalUV = rot2(tunSpiral * 1.2 + growthAmp * 0.6 + uTime * 0.04) * mandelPortalUV;
  float mandelZoom = mix(1.34, 0.57, clamp(bloomEnergy * 0.72 + tunPortal * 0.18 + tunInward * 0.10, 0.0, 1.0));
  mandelZoom *= 1.0 - 0.12 * uAudioBody;
  vec4 portalMandel = mandelbrotField(
    mandelPortalUV,
    uTime * mix(0.50, 0.28, afterglowSoft),
    mandelZoom,
    uAudioMorph + tunSpiral * 0.35,
    uAudioDetail,
    uAudioPulse + tunPortal * 0.28 + growthAmp * 0.20
  );
  float portalStructureMask = portalMask * smoothstep(0.08, 0.64, tunnelI + portalI * 0.78);
  float mandelPortal = portalStructureMask * (portalMandel.y * 0.58 + portalMandel.z * 0.38) * (0.26 + tunDepth * 0.56);
  float mandelVoid = portalStructureMask * portalMandel.w * (0.070 + tunInward * 0.040);
  vec3 mandelPortalTint = mandelPalette(portalMandel.x + polarT.z * 0.018 + layerCycle * 0.28, phaseHeat + uSpectralCentroid * 0.16);
  float tunnelGrowthWave = growthWaveBand(polarT.x, growthAge, growthAmp, 0.17) * (0.40 + tunGills * 0.60);
  const float WALL_CELL_SCALE = 1.8;
  const float WALL_CELL_DEPTH_SCALE = 1.1;
  float wallCells = cellularEdge(fieldUV * (WALL_CELL_SCALE + tunDepth * WALL_CELL_DEPTH_SCALE) + vec2(polarT.z * 0.055, -tBase * 0.045), tBase * 0.12 + polarT.z * 0.04);
  tunnelI += wallCells * tunDepth * (0.035 + uAudioDetail * 0.035) + tunnelGrowthWave * 0.42 + portalMandel.y * portalStructureMask * tunDepth * (0.026 + uAudioDetail * 0.026);
  vec3 tunnelTint = zoneColor(0.34 + polarT.z * 0.020 + tunGills * 0.05 + layerCycle * 0.46, vec3(0.00, 0.74, 0.88), 0.46, 1.20);
  vec3 tunnelDeep = deepColor(0.70 + polarT.z * 0.018 + layerCycle * 0.22, vec3(0.00, 0.035, 0.075));
  tunnelTint = mix(tunnelDeep, tunnelTint, smoothstep(0.05, 0.92, tunnelI));
  vec3 portalGold = zoneColor(0.76 + polarT.z * 0.035 + layerCycle * 0.30, vec3(1.00, 0.78, 0.10), 0.58, 1.42);
  vec3 portalAcid = zoneColor(0.92 + polarT.z * 0.028 + shimmerCycle * 0.040, vec3(0.48, 1.00, 0.14), 0.56, 1.48);
  vec3 portalTint = mix(portalGold, portalAcid, smoothstep(0.36, 0.90, phaseHeat + growthAmp * 0.30));
  vec3 waveTint = zoneColor(0.83 + shimmerCycle * 0.055 + growthAge * 0.16, vec3(0.64, 1.00, 0.10), 0.56, 1.48);
  // Behind blob: full strength; over blob silhouette: attenuated so the tunnel
  // reads as continuous backdrop rather than a flat overlay on top of the form.
  float tunnelBlobMask = hitDist > 0.0 ? (1.0 - silhouetteSoft * 0.48) * 0.70 : 1.0;
  float tunnelRimAtten = mix(1.0, 0.54, smoothstep(0.0, 1.55, length(tunnelUV)));
  float tunnelGain = 0.55 + tunDepth * 0.78;
  col *= 1.0 - mandelVoid * tunnelBlobMask;
  col += tunnelTint * tunnelI * tunnelBlobMask * tunnelRimAtten * tunnelGain;
  col += portalTint * portalI * tunnelBlobMask * 0.66;
  col += mandelPortalTint * mandelPortal * tunnelBlobMask * (0.060 + uAudioBrightness * 0.18 + phaseHeat * 0.070);
  col += waveTint * tunnelGrowthWave * tunnelBlobMask * tunnelRimAtten * (0.18 + phaseHeat * 0.10);

  // ── Organic atmosphere: low-amplitude vapor and depth, never a hard outline ─
  float missMask = hitDist > 0.0 ? 0.0 : 1.0;
  float surfaceMask = hitDist > 0.0 ? (1.0 - silhouetteSoft * 0.82) * smoothstep(0.10, 0.72, depth01) : 0.0;
  float proximityMist = smoothstep(0.08, 0.58, edgeProximity) * (1.0 - smoothstep(0.62, 0.94, edgeProximity));
  float atmosphereMask = vaporMist * atmosphereLift * (
    missMask * depthHaze * (0.016 + atmosphereDensity * 0.006) +
    proximityMist * screenHazeMask * (0.010 + audioAtmosphere * 0.008 + trailPersistence * 0.003) +
    surfaceMask * (0.005 + audioAtmosphere * 0.004 + engineSurfaceDetail * 0.002)
  );
  vec3 atmosphereColor = zoneColor(0.62 + fieldDetail * 0.12 + vaporMist * 0.08 + layerCycle * 0.34, vec3(0.24, 0.82, 0.92), 0.38, 1.10)
                       * (0.026 + fieldDetail * 0.010 + afterglowSoft * 0.008);
  // Journey-modulated envelope (was hard-clamped at 0.035) — silence stays calm
  // because atmosphereDensity is gated on audioPresence in useThreeScene.js.
  col += atmosphereColor * clamp(atmosphereMask, 0.0, 0.035 + atmosphereDensity * 0.060);

  // ── Subsurface proximity glow ─────────────────────────────────────────────
  float proxGlow = exp(-minD * minD * 4.6);
  float proxT    = fbm(fieldUV * 0.28 + vec2(t * 0.05, 0.0)) * 0.4 + fieldDetail * 0.08 + 0.72 + uColorShift * 0.3;
  float proxMask = hitDist > 0.0 ? 0.50 : smoothstep(0.02, 0.92, proxGlow) * (0.22 + audioAtmosphere * 0.20);
  col += zoneColor(proxT + 0.15 + layerCycle * 0.28, vec3(0.72, 0.14, 0.95), 0.36, 1.22) * proxGlow * proxMask * (0.030 + uCoreEnergy * 0.060 + audioAtmosphere * 0.016 + bloomEnergy * 0.015);

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
  float localMask = hitDist > 0.0 ? 0.62 * (1.0 - silhouetteSoft * 0.46) : smoothstep(0.08, 0.82, proxGlow);
  float procStrength = (0.018 + fluxLift * 0.10 + uTreblePulse * 0.014 + uAudioDetail * 0.014 + uAudioTurbulence * 0.018 + engineSurfaceDetail * 0.006)
                     * uProcIntensity * localMask * (0.42 + uSurfaceEnergy * 0.50);
  col += zoneColor(procN * 0.22 + cent * 0.18 + layerCycle * 0.30 + 0.58, vec3(0.14, 0.92, 0.54), 0.28 + phaseHeat * 0.10, 1.24) * procMask * procStrength;

  // Cellular veins: low-contrast membrane detail revealed by highs, not an overlay.
  float silenceSettle = mix(0.18, 1.0, audioPresence) * (1.0 - smoothstep(0.68, 1.0, uSilence) * 0.42);
  float veinTime = tBase * mix(0.018, 0.090, audioPresence);
  vec2 veinUV = fieldUV * (1.48 + fieldDetail * 0.34 + procN * 0.12 + myceliumPulse * 0.18)
              + organicAsym * 0.10
              + vec2(veinTime * (0.22 + myceliumPulse * 0.10), -veinTime * (0.17 + myceliumPulse * 0.08));
  float veinEdge = cellularEdge(veinUV, veinTime + uPalettePhase * 0.12);
  float veinBreakup = smoothstep(0.30, 0.88, procN * 0.55 + fieldDetail * 0.45);
  float veinReveal = smoothstep(0.05, 0.80, uHighMid * 0.62 + uTreble * 0.30 + uTreblePulse * 0.36 + myceliumPulse * bloomEnergy * 0.34)
                   + onsetAccent * 0.14;
  veinReveal = clamp(veinReveal, 0.0, 1.0);
  float veinSurfaceMask = hitDist > 0.0 ? 0.38 * (1.0 - silhouetteSoft * 0.78) : 0.0;
  // Bleed veins into the tunnel/atmosphere region at low amplitude so mycelium
  // reads as off-body strands, not just an overlay on the blob surface.
  float veinTunnelMask = missMask * smoothstep(0.04, 0.62, tunnelI) * tunDepth * 0.24;
  float veinAtmosphereMask = missMask * smoothstep(0.06, 0.42, proxGlow) * 0.18 + veinTunnelMask;
  float veinMask = (veinSurfaceMask + veinAtmosphereMask) * (0.40 + uSurfaceEnergy * 0.34 + myceliumPulse * 0.12) * uProcIntensity;
  float veinStrength = clamp(veinEdge * veinBreakup * veinReveal * veinMask * silenceSettle, 0.0, 0.016);
  vec3 veinColor = mix(
    zoneColor(0.54 + fieldDetail * 0.15 + procN * 0.10 + layerCycle * 0.28, vec3(0.52, 1.00, 0.12), 0.44, 1.38),
    zoneColor(0.78 + shimmerCycle * 0.050 + procN * 0.08, vec3(1.00, 0.72, 0.10), 0.48, 1.42),
    smoothstep(0.20, 0.88, growthAmp + phaseHeat * 0.45)
  );
  col += veinColor * veinStrength;

  // ── Energy filaments: sparse curved streaks, visible only during energetic moments ──
  // Threshold FBM at a tight band → sparse arcs; mask by energy+force so they
  // only surface during peaks. No second pass needed — lives in the same shader.
  float energyMask = clamp(forceEnergySum * 0.70 + uSurfaceEnergy * 0.54 + uParticleEnergy * 0.22 + uBassHi * 0.24 + uMidPulse * 0.10 + particleActivity * plasmaCreature * 0.22 + neuralBloom * bloomEnergy * 0.16, 0.0, 1.0);
  if (energyMask > 0.08) {
    vec2  filUV  = fieldUV * 3.8 + vec2(t * 0.06 + modeBias * 0.08, t * -0.04) + organicAsym * 0.22;
    float filN   = fbm(filUV);
    float filLine = smoothstep(0.54, 0.58, filN) * smoothstep(0.62, 0.58, filN);
    float trapLine = orbitTrapMask(filUV * (0.18 + modeCollapse * 0.04 + modeOrbit * 0.035), tBase * 0.32 + uAudioMorph * 0.9 + modeBias + asymPhase * 0.24);
    float filamentMix = clamp(0.18 + modeCollapse * 0.22 + modeOrbit * 0.12 + myceliumPulse * 0.10 + plasmaCreature * 0.08 + uAudioDetail * 0.14, 0.0, 0.58);
    filLine = mix(filLine, trapLine, filamentMix);
    float filT    = filN * 0.3 + uEnergy * 0.4 + uColorShift * 0.2 + uAudioBrightness * 0.08;
    float filamentSilhouetteMask = hitDist > 0.0 ? (1.0 - silhouetteSoft * 0.68) : 1.0;
    vec3 filamentColor = zoneColor(filT + layerCycle * 0.36, vec3(1.00, 0.24, 0.78), 0.38, 1.30);
    col += filamentColor * filLine * energyMask * (0.22 + uAudioDetail * 0.14 + particleActivity * 0.08) * filamentSilhouetteMask;
  }

  // ── Force-energy brightness: forces locally amplify field brightness ────────
  vec3 forceColor = zoneColor(layerCycle + 0.50 + shimmerCycle * 0.030, vec3(1.00, 0.54, 0.08), 0.46, 1.34);
  col += forceColor * forceEnergySum * (0.19 + uBassPulse * 0.07);
  col += forceColor * uColorSpike * 0.18;

  // ── Mouse energy ripple ────────────────────────────────────────────────────
  float mDist = length(fieldUV - uMouse);
  col += zoneColor(layerCycle + 0.46, vec3(0.55, 1.00, 0.14), 0.44, 1.36) * exp(-mDist * 3.2) * uMouseVel * 0.38;

  // ── Hi shimmer + intensity ─────────────────────────────────────────────────
  float fineSpark = smoothstep(0.08, 0.78, uHighMid + uTreblePulse * 0.35 + particleActivity * 0.16) * (0.024 + uTreble * 0.015 + plasmaCreature * 0.006);
  vec3 sparkColor = zoneColor(0.86 + shimmerCycle * 0.090 + uSpectralCentroid * 0.08, vec3(1.00, 0.82, 0.12), 0.50, 1.52);
  col += (uHi * 0.022 + fineSpark) * sparkColor * (0.62 + phaseHeat * 0.36);
  col *= 1.0 - modeCollapse * (0.08 + uAudioBody * 0.06) * (1.0 - smoothstep(0.40, 1.60, length(vUv * 2.0 - 1.0)));
  float exposure = clamp(0.46 + uIntensity * 0.48 + uAudioBrightness * 0.13 + uRms * 0.08 + journeyIntensity * 0.05 - uSilence * 0.11, 0.40, 1.16);
  col *= exposure;

  // ── Vignette ───────────────────────────────────────────────────────────────
  float vig = 1.0 - smoothstep(0.86, 1.85, length(vUv * 2.0 - 1.0)) * 0.55;
  col *= vig;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
