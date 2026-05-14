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
// Throat carve axis: pre-normalized in JS as a blend of +Y (cap-aligned) and
// camera-forward as journey/intensity rises. Slice A defaults to +Y so the
// blob silhouette opens upward like a fungal mouth; later slices lerp toward
// view-axis for a stronger pulled-through-the-portal read.
uniform vec3  uThroatAxis;
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
// Packed musical lanes — direct authority over tunnel/throat/rim/vein terms
// uAudioDriveA: x=subBody, y=bassPunch, z=midMotion, w=highSparkle
// uAudioDriveB: x=brightness, y=fluxPulse, z=motionEnergy, w=silenceAmount
uniform vec4  uAudioDriveA;
uniform vec4  uAudioDriveB;
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
  float familyPhase = uPaletteFamilyBlend * 0.20;
  vec3 cold = palette(t + familyPhase + heat * 0.035);
  vec3 hot = zoneColor(t + familyPhase + 0.24 + heat * 0.08, vec3(0.58, 1.00, 0.14), 0.44, 1.34);
  vec3 violet = zoneColor(t + familyPhase + 0.58, vec3(0.85, 0.24, 1.00), 0.34, 1.26);
  return mix(mix(cold, hot, heat * 0.55), violet, 0.18 + heat * 0.14);
}

struct MandelTraps {
  float smoothIter;
  float lineMask;
  float ringMask;
  float pointMask;
  float boundary;
  float inside;
};

MandelTraps mandelbrotField(vec2 uv, float time, float zoom, float audioMorph, float audioDetail, float audioPulse, float tunnelDepthPhase) {
  vec2 center = vec2(-0.62, 0.36);
  // Slow, shallow morph — anatomy evolves with tunnel depth phase, not twitchy morph.
  center += 0.022 * vec2(
    sin(time * 0.045 + audioMorph * 1.05 + tunnelDepthPhase * 0.22),
    cos(time * 0.040 + audioMorph * 0.85 + tunnelDepthPhase * 0.19)
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

    // Ring target: depth-first growth phase (tunnel travel), slow time — avoids fast LFO vs trap minima.
    float ringPhase = tunnelDepthPhase * 0.58 + time * 0.026 + audioMorph * 0.42;
    float ringRadius = mix(0.19, 0.33, 0.5 + 0.5 * sin(ringPhase));
    float ringD = abs(length(z) - ringRadius);
    trapRing = min(trapRing, ringD);

    vec2 trapP = 0.22 * vec2(sin(time * 0.11 + tunnelDepthPhase * 0.08), cos(time * 0.085 + tunnelDepthPhase * 0.06));
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

  MandelTraps result;
  result.smoothIter = clamp(smoothIter / float(MANDEL_MAX_ITER), 0.0, 1.0);
  result.lineMask  = 1.0 - smoothstep(0.004, 0.045 + audioDetail * 0.025, trapLine);
  result.ringMask  = 1.0 - smoothstep(0.004, 0.035 + audioDetail * 0.020, trapRing);
  result.pointMask = 1.0 - smoothstep(0.004, 0.030 + audioPulse  * 0.020, trapPoint);
  result.boundary  = smoothstep(0.18, 0.95, result.smoothIter) * escaped;
  result.inside    = 1.0 - escaped;
  return result;
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
  rings = pow(rings, 3.10);
  float breathPhase = sin(t * 0.42 + depth * 0.55);
  rings *= 1.0 + breath * 0.46 * breathPhase;
  float ridges = gillRidges(theta, depth, gills);
  float membraneSectors = floor(10.0 + gills * 6.0 + 0.5);
  float membranes = pow(0.5 + 0.5 * cos(theta * membraneSectors - depth * (0.72 + spiral * 0.48)), 3.35) * gills;
  float spiralRibs = pow(0.5 + 0.5 * sin(depth * (3.4 + spiral * 1.8) + theta * (2.0 + spiral * 4.0)), 2.55)
                   * (0.20 + spiral * 0.42);
  float radialFalloff = smoothstep(0.04, 1.30, r) * (1.0 - smoothstep(1.35, 2.10, r));
  return clamp(rings * 0.48 + ridges * 0.62 + membranes * 0.28 + spiralRibs * 0.24, 0.0, 2.05) * radialFalloff;
}

// Portal bloom: softened membrane band, interrupted by tunnel ribs so it reads
// as throat depth instead of a separate halo layer.
float portalBloom(vec3 polar, float bloom) {
  float band = exp(-pow((polar.x - 0.46) * 4.2, 2.0));
  float ribBreak = pow(0.5 + 0.5 * sin(polar.y * 10.0 + polar.z * 1.15), 1.6);
  float depthAbsorb = pow(0.5 + 0.5 * cos(polar.z * 2.4 - polar.y * 5.0), 2.0);
  float membraneBreak = (0.42 + ribBreak * 0.58) * (0.72 + depthAbsorb * 0.28);
  float throat = exp(-pow(polar.x * 3.4, 2.0));
  return (band * 0.40 * membraneBreak + throat * 0.20) * bloom;
}

struct OrganismField {
  vec2 coord;
  float radius;
  float rim;
  float cap;
  float underside;
  float throat;
  float gill;
  float membrane;
  float environment;
};

OrganismField getWorldField(vec2 fieldUV, vec2 organicAsym, vec3 polarT, vec3 p, float hitMask, float detail, float tBase) {
  OrganismField f;
  f.coord = fieldUV + organicAsym * (0.055 + detail * 0.030);
  f.radius = length(f.coord);

  float surfaceR = length(p.xz);
  float fieldRim = smoothstep(0.32, 0.82, f.radius) * (1.0 - smoothstep(0.86, 1.46, f.radius));
  float surfaceRim = smoothstep(0.22, 0.86, surfaceR) * (1.0 - smoothstep(0.95, 1.34, surfaceR));
  f.rim = mix(fieldRim, surfaceRim, hitMask);

  float fieldCap = (1.0 - smoothstep(0.55, 1.35, f.radius)) * (0.50 + detail * 0.20);
  float surfaceCap = smoothstep(-0.18, 0.46, p.y);
  f.cap = mix(fieldCap, surfaceCap, hitMask);

  float fieldUnder = smoothstep(0.18, 0.92, f.radius) * (1.0 - smoothstep(1.08, 1.72, f.radius));
  float surfaceUnder = smoothstep(0.12, -0.52, p.y);
  f.underside = mix(fieldUnder, surfaceUnder, hitMask);

  float throatRadial = (1.0 - smoothstep(0.10, 0.78, polarT.x)) * smoothstep(0.015, 0.22, polarT.x);
  float throatOpen = smoothstep(0.02, 0.70, uTunnelA.y + uTunnelB.y * 0.45 + uTunnelB.w * 0.24);
  f.throat = throatRadial * throatOpen * (0.42 + uTunnelA.x * 0.58);

  float gillSectors = floor(10.0 + uTunnelA.z * 6.0 + 0.5);
  float gillWave = pow(0.5 + 0.5 * sin(polarT.y * gillSectors + polarT.z * 0.62 + tBase * 0.34), 2.05);
  float gillOpen = smoothstep(0.04, 0.78, uTunnelA.z + uAudioMorph * 0.38 + uMidPulse * 0.16);
  f.gill = gillWave * gillOpen * clamp(f.underside * 0.72 + f.rim * 0.48 + f.throat * 0.30, 0.0, 1.0);

  f.environment = smoothstep(0.08, 1.32, polarT.x)
                * (1.0 - smoothstep(1.28, 2.08, polarT.x))
                * (0.34 + uTunnelA.x * 0.48 + uEngineC.z * 0.18);
  f.membrane = clamp(f.rim * 0.36 + f.cap * 0.18 + f.underside * 0.26 + f.throat * 0.40 + f.gill * 0.34 + f.environment * 0.18, 0.0, 1.0);
  return f;
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// ── Blob pressure field sampler ──────────────────────────────────────────────
// Samples the blob's biological math at a virtual screen-space probe point.
// Returns structured pressure terms used to deform tunnel/membrane field.
// The blob SDF still exists for raymarching; this is the hidden-organ path.
struct BlobPressure {
  float bodyMask;     // 0..1 — 1 inside conceptual body, fades outward
  float throatMask;   // 0..1 — concentration along uThroatAxis
  float gillField;    // -0.5..0.5 — radial sector ripple (12 sectors)
  float coreFlow;     // FBM body warp intensity
  float capLobe;      // slow off-axis sinusoid
  float breath;       // ambient breathing (always alive)
};

BlobPressure samplePressure(vec2 uv2, float tBase, float t) {
  // Virtual 3D probe in screen space, offset along uThroatAxis slightly
  vec3 probe = vec3(uv2 * 1.1, 0.0) - uThroatAxis * 0.10;
  float probeLen = length(probe);

  // Reuse same math as sdfBlob (coreFlow, gills, capLobe, breath) — no new noise
  float warp = 0.28;
  vec3 q = probe + warp * 0.30 * vec3(
    sin(probe.y * 1.85 + t * 1.0) + cos(probe.z * 1.48 + t * 0.72),
    cos(probe.x * 1.72 + t * 0.64) + sin(probe.z * 2.04 + t * 1.04),
    sin(probe.x * 1.36 + t * 0.80) + cos(probe.y * 2.34 + t * 0.54)
  );
  float cF = fbm3(q * 0.72 + tBase * 0.08) * (0.18 + uCoreEnergy * 0.22);
  float gillAngle = atan(q.z, q.x);
  float gillSector = sin(gillAngle * 12.0 + tBase * 0.4) * 0.5;  // -0.5..0.5
  float capL = sin(q.x * 1.3 + tBase * 0.21) * cos(q.z * 1.1 - tBase * 0.17) * 0.5 + 0.5;
  float brt = sin(tBase * 0.7) * 0.5 + 0.5;

  // Body mask: fades from 1 at screen center to 0 at periphery
  float bodyRadius = 0.34 + uModeBlend.z * 0.10 + uModeBlend.w * 0.06;
  float bMask = smoothstep(bodyRadius + 0.65, bodyRadius - 0.05, probeLen);

  // Throat mask: Gaussian along uThroatAxis direction in screen
  float along = dot(vec3(uv2, 0.0), uThroatAxis);
  float distToAxis = length(vec3(uv2, 0.0) - uThroatAxis * along);
  float tMask = exp(-distToAxis * distToAxis * 6.0);

  BlobPressure bp;
  bp.bodyMask   = clamp(bMask, 0.0, 1.0);
  bp.throatMask = clamp(tMask, 0.0, 1.0);
  bp.gillField  = gillSector;
  bp.coreFlow   = clamp(cF, 0.0, 1.0);
  bp.capLobe    = capL;
  bp.breath     = brt;
  return bp;
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
  // Per-mode dissolve: Drift/Gills/Spiral → 0.28 (hard), Pulse → 0.44, Orbit → 0.38.
  // uModeBlend.z = Collapse/Pulse, uModeBlend.w = Orbit.
  float bodyShrinkBase = 0.28
    + uModeBlend.z * 0.16
    + uModeBlend.w * 0.10;
  float bodyRadius = bodyShrinkBase
                   + uCoreEnergy * 0.08
                   + uAudioDriveA.x * 0.06
                   + uAudioDriveA.y * 0.025
                   + disp + breath;
  float blobDist = length(qShape) - bodyRadius;

  // Throat carve: subtract a tapered cylinder along uThroatAxis from the blob
  // so the silhouette reads as a rim wrapping an opening instead of a closed
  // cap. Orbit mode (uMode == 4) is skipped here because sdfOrbit passes
  // offset coords to three blob copies; carving each one would produce three
  // disconnected throats. Slice D may revisit orbit with a post-smin carve.
  float carved;
  if (uMode == 4) {
    carved = blobDist;
  } else {
    float along = dot(p, uThroatAxis);
    float distToAxis = length(p - uThroatAxis * along);
    // Throat widens dramatically to hollow out the body; Pulse/Orbit stay narrower
    // so the pressure-organ shape (Pulse) and rim anchors (Orbit) remain visible.
    float throatWiden = 1.0 - uModeBlend.z * 0.30 - uModeBlend.w * 0.15;
    float throatBase = (0.42 + uTunnelA.y * 0.22 + uTunnelB.y * 0.10
                     + uAudioDriveA.x * 0.10
                     + uAudioDriveA.y * 0.22
                     ) * throatWiden;
    // Taper deeper into the form — narrower exit = stronger membrane-wall read
    float taper = mix(1.05, 0.30, smoothstep(0.05, 0.85, -along));
    float throatSDF = distToAxis - throatBase * taper;
    // Soft CSG subtraction: smin softens the throat lip so raymarch normals
    // don't pop at the rim. k=0.08 keeps the lip defined but rounded.
    carved = -smin(-blobDist, throatSDF, 0.08);
  }
  return carved * 0.85;
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
  // Portal quiet stability: high silence + low presence → strip audio jitter from masks; trailPersistence
  // tightens "settled" hush (20–30s style) without freezing uTime/depth evolution.
  float portalQuiet = smoothstep(0.36, 0.84, uSilence) * mix(1.0, 1.0 - smoothstep(0.10, 0.72, audioPresence), 0.94);
  float portalQuietDeep = portalQuiet * smoothstep(0.08, 0.42, trailPersistence);
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
                     * (0.32 + modeFluid * 0.18 + modeRadial * 0.30 + modeVortex * 1.48 + modeCollapse * 0.42 + modeOrbit * 0.46)
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
    float collapseZ = mix(2.4, uCameraDistance, 0.45) - uCoreEnergy * 0.10 + uSurfaceEnergy * 0.20 - myceliumPulse * bloomEnergy * 0.06;
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

  // Shared portal/anatomy basis. The polar tunnel remains seam-safe, but every
  // later cap/gill/throat/fog layer now sees the same warped organism field.
  vec2 rawTunnelUV = (vUv * 2.0 - 1.0) * vec2(aspect, 1.0);
  rawTunnelUV += organicAsym * 0.045 + uCamDrift * 0.12;
  const float COORD_COUPLE = 0.24;
  vec2 tunnelUV = mix(rawTunnelUV, fieldUV, COORD_COUPLE);
  float tunDepth   = clamp(uTunnelA.x, 0.0, 1.0);
  float tunInward  = clamp(uTunnelA.y, 0.0, 1.0);
  float tunGills   = clamp(uTunnelA.z, 0.0, 1.0);
  float tunSpiral  = clamp(uTunnelA.w, 0.0, 1.0);
  float tunBreath  = clamp(uTunnelB.x, 0.0, 1.0);
  float tunPortal  = clamp(uTunnelB.y, 0.0, 1.0);
  vec3 polarT = tunnelCoords(tunnelUV, tBase, tunInward, tunSpiral);
  float portalMask = (1.0 - smoothstep(0.10, 0.78, polarT.x)) * smoothstep(0.015, 0.20, polarT.x);
  OrganismField organism = getWorldField(fieldUV, organicAsym, polarT, vec3(0.0), 0.0, fieldDetail, tBase);

  // Sample blob pressure field — reuses blob math without rendering a surface.
  // bp drives tunnel density, throat, wall torsion, rib pressure, vein glow.
  BlobPressure bp = samplePressure(sUV, tBase, t);

  vec3 hitCol = vec3(0.0);
  vec3 missCol = vec3(0.0);
  float silhouetteSoft = 0.0;

  if (hitDist > 0.0) {
    // ── Surface: diffuse volume + gated detail ──────────────────────────────
    vec3  p    = ro + rd * hitDist;
    vec3  nrm  = calcNormal(p, tJitter, tBase, uBass, uMid, uChaos, uMode);
    organism = getWorldField(fieldUV, organicAsym, polarT, p, 1.0, fieldDetail, tBase);
    // Field weight rebalance: throat primary, gills secondary, cap nearly gone.
    // Rim boosted so remaining surface reads as a membrane rim not a body cap.
    organism.throat *= 1.9;
    organism.gill   *= 1.6;
    organism.cap    *= 0.10;
    organism.rim    *= 1.4;
    vec3  lDir  = normalize(vec3(sin(t * 0.35) * 1.2, 0.8, cos(t * 0.35) * 1.2));
    vec3  lFill = normalize(vec3(-sin(t * 0.27) * 0.9, -0.55, -cos(t * 0.27) * 0.9));
    float wrapKey  = dot(nrm, lDir)  * 0.5 + 0.5;
    float wrapFill = dot(nrm, lFill) * 0.5 + 0.5;
    float diff = wrapKey * 0.30 + wrapFill * 0.12 + 0.036 + uCoreEnergy * 0.040;

    // t driven by value + energy + depth: foreground/high-energy → magenta/cyan
    float noiseV  = fbm3(p * 0.55 + t * 0.08);
    float surfaceDetail = fbm3(p * (2.0 + uSurfaceEnergy * 1.2 + uHighMid * 0.7 + engineSurfaceDetail * 0.34) + tDetail * (0.14 + uTreble * 0.030 + journeyIntensity * 0.030));
    surfaceDetail *= 0.85 + (bgN - 0.5) * 0.30;
    float surfDepth = clamp(hitDist / maxDist, 0.0, 1.0);
    float viewSoft = pow(1.0 - clamp(dot(nrm, -rd), 0.0, 1.0), 2.15);
    float grazingSoft = smoothstep(0.34, 0.92, viewSoft);
    silhouetteSoft = grazingSoft;
    float interiorDetailMask = 1.0 - grazingSoft * 0.72;
    float surfaceR = length(p.xz);
    float capZone = mix(smoothstep(-0.18, 0.46, p.y), organism.cap, 0.34);
    float undersideZone = mix(smoothstep(0.12, -0.52, p.y), organism.underside, 0.40);
    float rimZone = mix(
      smoothstep(0.22, 0.86, surfaceR) * (1.0 - smoothstep(0.95, 1.34, surfaceR)),
      organism.rim,
      0.46
    );
    float throatZone = organism.throat * (0.42 + rimZone * 0.58) * (1.0 - smoothstep(0.84, 1.42, surfaceR));
    float gillAnatomy = clamp(organism.gill * (0.62 + undersideZone * 0.38), 0.0, 1.0);
    float membraneMask = clamp(organism.membrane * interiorDetailMask, 0.0, 1.0);
    float featureAuthority = clamp(throatZone * 1.45 + gillAnatomy * 0.95 + rimZone * 0.55, 0.0, 1.0);
    float broadShellMask = clamp((1.0 - featureAuthority) * (1.0 - throatZone * 0.82) * (1.0 - gillAnatomy * 0.72), 0.0, 1.0);
    float growthSurfaceWave = growthWaveBand(length(p.xz), growthAge, growthAmp, 0.150) * interiorDetailMask;
    float materialZones = (capZone - undersideZone) * 0.10 + (surfaceDetail - 0.5) * 0.12 + (bgN - 0.5) * 0.06 + throatZone * 0.08;
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
    vec3 tunnelTissueHint = mix(
      deepColor(ct + 0.44, vec3(0.00, 0.045, 0.09)),
      zoneColor(ct + 0.36 + layerCycle * 0.42, vec3(0.00, 0.72, 0.92), 0.52, 1.32),
      clamp(organism.throat * 0.55 + rimZone * 0.35 + throatZone * 0.45, 0.0, 1.0)
    );
    vec3 surfaceBase = mix(fleshCol, foldCol, undersideZone * 0.55 + viewSoft * 0.32);
    surfaceBase = mix(surfaceBase, membraneCol, capZone * growthSurfaceWave * 0.36);
    surfaceBase = mix(surfaceBase, mix(foldCol, coolMembrane, 0.35) * 0.72, broadShellMask * 0.26);
    surfaceBase = mix(surfaceBase, tunnelTissueHint, broadShellMask * viewSoft * (0.14 + throatZone * 0.38));

    hitCol  = surfaceBase * diff * 0.34 * (0.22 + featureAuthority * 0.78);
    hitCol += mix(violetFlesh, coolMembrane, 0.34) * membraneMask * (0.040 + audioPresence * 0.032 + uAudioBody * 0.018 + calmMotion * 0.010) * (0.35 + featureAuthority * 0.65);
    hitCol += membraneCol * surfaceDetail * membraneMask * (uSurfaceEnergy * 0.034 + uHighMid * 0.014 + engineSurfaceDetail * 0.008) * (0.30 + featureAuthority * 0.70);
    hitCol += acidAccent * growthSurfaceWave * (0.020 + phaseHeat * 0.014) * (rimZone * 0.62 + gillAnatomy * 0.46 + throatZone * 0.70);
    hitCol += foldCol * undersideZone * (0.010 + uAudioMorph * 0.008) * (0.35 + featureAuthority * 0.65);
    // Outer halo dampened (× 0.55) so the fresnel ring around the silhouette
    // stops competing with the new internal throat glow. Internal grazing
    // contributions (innerGlow below) remain at full strength.
    hitCol += zoneColor(ct + 0.35, vec3(0.14, 0.75, 1.00), 0.34, 1.24) * viewSoft * (0.006 + uHi * 0.004 + audioAtmosphere * 0.003) * (1.0 - surfDepth * 0.42) * interiorDetailMask * (0.18 + featureAuthority * 0.34);
    float surfaceEdgeFill = smoothstep(0.12, 0.80, viewSoft) * edgeFeather;
    hitCol += acidAccent * surfaceEdgeFill * (0.003 + uCoreEnergy * 0.002 + audioAtmosphere * 0.001 + growthAmp * 0.004) * (1.0 - surfDepth * 0.35) * (0.22 + membraneMask * 0.38) * featureAuthority;
    hitCol += deepColor(ct + 0.56, vec3(0.02, 0.05, 0.10)) * 0.016;
    hitCol += uCoreEnergy * membraneCol * (0.006 + membraneMask * 0.012) * (0.28 + featureAuthority * 0.72);
    hitCol += mix(acidAccent, coolMembrane, 0.42) * throatZone * (0.052 + uAudioBrightness * 0.060 + uAudioPulse * 0.070);

    float surfaceGillAngle = atan(p.z, p.x);
    float surfaceGills = pow(sin(surfaceGillAngle * 12.0 + tBase * 0.40) * 0.5 + 0.5, 2.1);
    float capGillMask = capZone * rimZone * (1.0 - smoothstep(0.18, 0.90, viewSoft)) * 0.54;
    float surfaceGillMask = clamp(undersideZone * 0.72 + capGillMask + gillAnatomy * 0.62, 0.0, 1.0) * interiorDetailMask * (1.0 - smoothstep(0.10, 0.86, viewSoft));
    float gillOpen = smoothstep(0.08, 0.74, uAudioMorph + uMidPulse * 0.30 + growthAmp * 0.42);
    float gillCrease = (1.0 - surfaceGills) * surfaceGillMask * gillOpen * (0.18 + uAudioMorph * 0.18 + growthSurfaceWave * 0.20);
    hitCol *= 1.0 - clamp(gillCrease, 0.0, 0.38);
    float surfaceGillAmp = (0.014 + uAudioMorph * 0.026 + uAudioDetail * 0.018 + growthSurfaceWave * 0.036) * surfaceGillMask * (0.55 + featureAuthority * 0.45);
    vec3 gillCol = mix(membraneCol, acidAccent, surfaceGills * (0.36 + gillOpen * 0.34));
    hitCol += gillCol * surfaceGills * surfaceGillAmp;

    vec2 mandelGillUV = vec2(
      surfaceGillAngle / TAU,
      p.y * 0.65 + length(p.xz) * 0.35
    ) * 2.0 - 1.0;
    mandelGillUV.x *= 1.6;
    mandelGillUV += organicAsym * 0.035;
    mandelGillUV = rot2(0.05 * sin(uTime * 0.09) + 0.10 * uAudioMorph) * mandelGillUV;
    MandelTraps gillMandel = mandelbrotField(
      mandelGillUV,
      uTime * mix(0.54, 0.34, afterglowSoft) + 11.0,
      mix(1.16, 0.68, clamp(uAudioMorph * 0.75 + gillOpen * 0.25, 0.0, 1.0)),
      uAudioMorph,
      uAudioDetail,
      uAudioPulse + growthAmp * 0.35,
      p.y * 0.38 + length(p.xz) * 0.24 + tBase * 0.05
    );
    float gillTrapCombined = clamp(gillMandel.lineMask * 0.55 + gillMandel.ringMask * 0.35 + gillMandel.pointMask * 0.45, 0.0, 1.0);
    float fractalGillZone = surfaceGillMask * undersideZone * rimZone * (0.38 + gillAnatomy * 0.62);
    float fractalGillAudioGate = mix(0.10, 1.0, audioPresence) * mix(0.82, 1.0, calmMotion * 0.35 + tunBreath * 0.65);
    float fractalGillGrowthGate = smoothstep(0.02, 0.78, gillOpen * 0.64 + growthAmp * 0.40 + bloomEnergy * 0.12);
    float fractalGillMask = fractalGillZone * fractalGillAudioGate * fractalGillGrowthGate;
    float fractalGillRibs = gillTrapCombined * fractalGillMask;
    float fractalVeinGlow = gillMandel.boundary * fractalGillMask;
    float fractalDarkFold = gillMandel.inside * fractalGillMask * (0.11 + undersideZone * 0.10);
    vec3 mandelGillCol = mandelPalette(gillMandel.smoothIter + ct * 0.12 + layerCycle * 0.18, phaseHeat + uSpectralCentroid * 0.16);
    hitCol = mix(hitCol, hitCol * 0.62, clamp(fractalDarkFold, 0.0, 0.24));
    hitCol += mandelGillCol * fractalGillRibs * (0.018 + uAudioDetail * 0.030 + growthAmp * 0.014);
    hitCol += mix(coolMembrane, acidAccent, 0.34 + phaseHeat * 0.20) * fractalVeinGlow * (0.014 + uAudioPulse * 0.030 + uAudioBrightness * 0.014);

    // Mycelium on the core surface: cellularEdge sampled in surface space,
    // driven by morph/detail/turbulence audio signals. Reads as carved
    // biological vein texture, not an overlay.
    const float CORE_VEIN_SCALE = 1.6;
    const float CORE_VEIN_MORPH_SCALE = 0.6;
    vec2  coreVeinUV  = fieldUV * (CORE_VEIN_SCALE + uAudioMorph * CORE_VEIN_MORPH_SCALE) + vec2(tBase * 0.06, -tBase * 0.04);
    float coreVein    = cellularEdge(coreVeinUV, tBase * 0.22 + uPalettePhase * 0.10);
    float coreVeinPresenceGate = mix(0.18, 1.0, audioPresence);
    // highSparkle gates vein glints — tiny and gated, not permanently on
    float highSparkleGate = mix(0.04, 1.0, smoothstep(0.06, 0.5, uAudioDriveA.w));
    float coreVeinAmp = (0.006 + uAudioDetail * 0.026 + uAudioTurbulence * 0.010) * membraneMask * coreVeinPresenceGate * highSparkleGate * (0.22 + rimZone * 0.34 + gillAnatomy * 0.34 + throatZone * 0.28);
    hitCol += mix(acidAccent, zoneColor(ct + 0.42, vec3(1.0, 0.78, 0.14), 0.50, 1.44), coreVein * phaseHeat * 0.6) * coreVein * coreVeinAmp;

    // Inner glow at grazing angles: light leaking through translucent
    // membrane. Direct brightness + subBody authority for stronger response.
    float innerGlow = (pow(grazingSoft, 1.7) * 0.18 + throatZone * 0.82 + gillAnatomy * 0.34)
                    * (0.014 + uAudioDriveA.x * 0.080 + uAudioDriveB.x * 0.100);
    hitCol += mix(membraneCol, acidAccent, growthSurfaceWave * 0.55 + uAudioBrightness * 0.16) * innerGlow * (1.0 - surfDepth * 0.30) * (0.42 + membraneMask * 0.58);
    float coolMembraneMask = clamp(
      (0.16 + undersideZone * 0.24 + (1.0 - capZone) * 0.10 + surfaceDetail * 0.18 + growthSurfaceWave * 0.10)
      * (1.0 - phaseHeat * 0.16),
      0.0,
      0.38
    );
    hitCol = mix(hitCol, mix(coolMembrane, tunnelTissueHint, 0.55) * (0.14 + diff * 0.34), coolMembraneMask * (0.42 + featureAuthority * 0.58));

    // rimDissolve: broad body loses; throat/gill/rim features keep authority.
    float rimDissolve = clamp(rimZone * 0.6 + throatZone * 0.5 + gillAnatomy * 0.4, 0.0, 1.0);
    hitCol *= mix(0.12, 0.90, max(rimDissolve, featureAuthority));

    hitCol *= (1.0 - surfDepth * 0.15);
    // Edge erosion: silhouette feathered by mutation noise so it doesn't read
    // as a clean smooth circle. Replaces the prior uniform grazing→fog mix.
    float erodeMask = fbm(p.xy * 4.5 + vec2(tBase * 0.07, 0.0));
    float erodeBlend = grazingSoft * (0.42 + audioAtmosphere * 0.18) * (1.0 - surfDepth * 0.18)
                     * (0.55 + erodeMask * 0.45);
    hitCol = mix(hitCol, fogColor, erodeBlend);
    // Atmospheric fog: blend toward near-black at depth
    hitCol  = mix(hitCol, fogColor, smoothstep(0.3, 0.9, surfDepth));

  } else {
    // ── Volumetric glow: near-miss rays accumulate fog ───────────────────────
    // Glow stronger in foreground (small depth01), fades at back
    float internalGlowMask = clamp(organism.throat * 0.72 + organism.rim * 0.22 + organism.gill * 0.20 + organism.environment * 0.10, 0.0, 1.0);
    float glowStr = mix(0.088, 0.030, depth01) * (0.88 + atmosphereDensity * 0.16);
    float glow    = exp(-minD * 1.58) * glowStr * (0.084 + audioAtmosphere * 0.096 + uCoreEnergy * 0.040 + calmMotion * 0.012) * (0.46 + internalGlowMask * 1.08);
    float bgT = bgN * 0.36 + 0.72 + uColorShift * 0.3 + uAudioBrightness * 0.04;
    float bgDepthFade = (1.0 - smoothstep(0.0, 0.46, depth01)) * (0.42 + organism.environment * 0.58);
    // Slice B: pull the bg fog anchor toward the tunnel's deep teal across the
    // mid-polar band where the tunnel field is most present, so the background
    // reads as a continuation of the same membrane field rather than wallpaper
    // behind the portal. Falloff matches tunnelLayer's radialFalloff so the
    // tint shows up exactly where the portal lives.
    float bgTunnelPull = smoothstep(0.08, 0.74, polarT.x)
                       * (1.0 - smoothstep(1.10, 1.90, polarT.x)) * 0.55;
    vec3 bgFogAnchor = mix(vec3(0.00, 0.18, 0.21), vec3(0.03, 0.06, 0.13), bgTunnelPull);
    // subBody modulates fog density — whole field breathes with sub-bass
    float subBodyBreath = 1.0 + uAudioDriveA.x * 0.5 + bp.bodyMask * 0.3;
    vec3 bgFog = deepColor(bgT + layerCycle + fieldDetail * 0.035, bgFogAnchor) * (0.066 + bgN * 0.020 + fieldDetail * 0.008 + uCoreEnergy * 0.016 + uAudioDriveB.x * 0.012) * bgDepthFade * subBodyBreath;
    vec3 bgGlowCol = zoneColor(bgT + layerCycle * 0.55, vec3(0.00, 0.92, 1.00), 0.50, 1.30);
    missCol  = bgGlowCol * glow * (0.28 + uCoreEnergy * 0.22);
    missCol += bgFog;
    missCol *= (1.0 - depthFog * 0.34);
    missCol += zoneColor(bgT + 0.30 + layerCycle * 0.30, vec3(0.16, 0.06, 0.45), 0.36, 1.16) * depthFog * 0.006 * (0.4 + uCoreEnergy * 0.16 + atmosphereDensity * 0.08);
    missCol  = mix(missCol, fogColor, smoothstep(0.5, 1.0, depth01));
  }

  vec3 col = hitDist > 0.0 ? hitCol : missCol;

  // ── Tunnel / portal depth layer (Stage 11) ──────────────────────────────────
  // Polar field composited behind the SDF surface. Reads as inward travel —
  // concentric depth rings + radial gill ridges + breathing pulse. Driven per
  // mode by uTunnelA / uTunnelB; gated by audio presence so silence stays calm.
  // Per-mode weights (hoisted: motion multipliers below need them).
  float mDrift  = clamp(1.0 - max(max(uModeBlend.x, uModeBlend.y), max(uModeBlend.z, uModeBlend.w)), 0.0, 1.0);
  float mGills  = uModeBlend.x;
  float mSpiral = uModeBlend.y;
  float mPulse  = uModeBlend.z;
  float mOrbit  = uModeBlend.w;

  // Three depth-speed layers — far membrane, mid ribs/rings, near veins/glints —
  // so the eye perceives forward travel rather than one flat scroll.
  float silenceSlow = 1.0 - uAudioDriveB.w * 0.32;
  float modeSlowMul = 1.0 + mDrift  * 0.28 + mSpiral * 0.12;
  float modeMidMul  = 1.0 + mGills  * 0.28 + mSpiral * 0.78 + mPulse * 0.12;
  float modeFastMul = 1.0 + mOrbit  * 0.35 + mPulse  * 0.18 + mSpiral * 0.34;
  float forwardSlow = (tBase * 0.34 + uAudioDriveA.x * 0.95 + uAudioDriveB.z * 0.68) * silenceSlow * modeSlowMul;
  float forwardMid  = (tBase * 0.62 + uAudioDriveA.z * 2.75 + uAudioDriveB.z * 1.55) * silenceSlow * modeMidMul;
  float forwardFast = (tBase * 0.96 + uAudioDriveA.z * 3.65 + uAudioDriveB.z * 2.10 + uAudioDriveA.w * 0.62 + uAudioDriveB.y * 0.45) * silenceSlow * modeFastMul;
  float depthTravel = forwardSlow * 0.44 + forwardMid * 0.42 + forwardFast * 0.20;
  float bassBounceRaw = smoothstep(0.025, 0.38, uAudioDriveA.y);
  float bassBounce = pow(bassBounceRaw * bassBounceRaw * (3.0 - 2.0 * bassBounceRaw), 0.72);
  float midSlide = smoothstep(0.04, 0.62, uAudioDriveA.z);
  float fluxShimmer = smoothstep(0.03, 0.34, uAudioDriveB.y);
  float pulseThroatPump = mPulse * uAudioDriveA.y * 0.32;

  // Organic depth wobble — bends rib/ring/trap depth without touching theta/r
  // (theta has the atan branch cut; r has fragile radial gates; depth is safe).
  vec2 depthWarp = fbm2(fieldUV * 1.4 + vec2(tBase * 0.06, -tBase * 0.04));
  float depthBendNoisy = (depthWarp.x - 0.5) * (0.30 + uAudioDriveA.z * 0.62 + uAudioDriveB.z * 0.36);
  float depthBendCalm = (depthWarp.x - 0.5) * (0.12 + calmMotion * 0.07 + tunBreath * 0.08 + forwardSlow * 0.004);
  float depthBend = mix(depthBendNoisy, depthBendCalm, portalQuiet);
  vec3 polarTwarp = vec3(polarT.x, polarT.y, polarT.z + depthBend + depthTravel);

  float tunnelI = tunnelLayer(polarTwarp, tunGills, tunBreath, tunSpiral, tBase);
  float bassBouncePortal = bassBounce * (1.0 - portalQuiet * 0.88);
  vec3 portalBounce = vec3(polarT.x * (1.0 - bassBouncePortal * 0.115), polarT.y, polarT.z + bassBouncePortal * 0.62);
  float portalI = portalBloom(portalBounce, tunPortal * (1.0 + bassBouncePortal * 0.58));
  float cent01 = clamp(uSpectralCentroid, 0.0, 1.0);
  // Portal Mandelbrot chart: theta × log-depth so anatomy grows with tunnel travel, not 2D slide.
  float mandelGrowthTheta = polarT.y + forwardSlow * 0.038 + tunSpiral * 0.10;
  float mandelGrowthDepth = polarTwarp.z * 0.040 + polarT.x * 0.36 - tunInward * 0.07;
  vec2 mandelGrowthChart = vec2(mandelGrowthTheta * 0.54, mandelGrowthDepth * 0.60);
  vec2 mandelPortalUV = mix(tunnelUV, mandelGrowthChart, 0.58);
  mandelPortalUV += depthBend * vec2(0.021, -0.015);
  float growthAmpQ = mix(growthAmp, growthAmp * 0.38 + tunBreath * 0.28 + calmMotion * 0.22, portalQuiet);
  float growthSpin = tunSpiral * 1.05 + growthAmpQ * 0.46 + polarTwarp.z * 0.034 + forwardSlow * 0.052;
  mandelPortalUV = rot2(growthSpin) * mandelPortalUV;
  // Zoom: compress hot bloom/centroid tails; in silence/afterglow bias toward depth-travel baseline.
  float centRemap = smoothstep(0.06, 0.94, cent01);
  float bloomRemap = smoothstep(0.05, 0.90, bloomEnergy);
  float zoomExcite = bloomRemap * 0.30 + tunPortal * 0.24 + tunInward * 0.18 + centRemap * 0.32;
  zoomExcite = pow(clamp(zoomExcite, 0.0, 1.0), 1.12);
  float zoomSlow = smoothstep(-0.8, 5.5, polarTwarp.z * 0.11 + tunDepth * 0.52 + tunInward * 0.28 + forwardSlow * 0.042);
  float quietHug = clamp(
    (1.0 - audioPresence) * (0.38 + calmMotion * 0.34 + tunBreath * 0.44) + afterglowSoft * 0.36,
    0.0,
    0.90
  );
  float mandelZoomDrive = clamp(mix(zoomExcite, max(zoomExcite * 0.68, zoomSlow), max(quietHug, portalQuiet * 0.42)), 0.0, 1.0);
  float mandelZoom = mix(1.34, 0.57, mandelZoomDrive);
  mandelZoom *= 1.0 - 0.10 * uAudioBody * mix(1.0, 0.22, portalQuiet);
  float mandelTunnelPhase = polarTwarp.z * 0.055 + forwardSlow * 0.038;
  float mandelTime = uTime * mix(0.50, 0.28, afterglowSoft) + forwardMid * 0.048 + polarTwarp.z * 0.019;
  float mandelMorphQ = mix(uAudioMorph + tunSpiral * 0.35, tunSpiral * 0.35 + calmMotion * 0.11 + tunBreath * 0.09, portalQuiet);
  float mandelDetailQ = mix(uAudioDetail, max(uAudioDetail * 0.30, 0.09) + tunBreath * 0.055 + calmMotion * 0.045, portalQuiet);
  float mandelPulseQ = mix(
    uAudioPulse + tunPortal * 0.28 + growthAmp * 0.20,
    tunPortal * 0.28 + growthAmp * 0.16 + calmMotion * 0.035 + tunBreath * 0.055,
    portalQuiet
  );
  MandelTraps portalMandel = mandelbrotField(
    mandelPortalUV,
    mandelTime,
    mandelZoom,
    mandelMorphQ,
    mandelDetailQ,
    mandelPulseQ,
    mandelTunnelPhase
  );
  float portalAudioGate = mix(0.10, 1.0, audioPresence) * mix(0.86, 1.0, tunBreath * 0.55 + calmMotion * 0.45);
  float portalDepthGate = smoothstep(0.08, 0.78, tunDepth);
  float portalInwardGate = smoothstep(0.02, 0.62, tunInward + tunPortal * 0.35 + growthAmp * 0.18);
  float anatomyThroatGate = clamp(organism.throat * 0.82 + organism.gill * 0.18 + organism.rim * 0.12, 0.0, 1.0);
  float portalStructureMask = portalMask
                            * smoothstep(0.05, 0.52, tunnelI + portalI * 0.78)
                            * portalDepthGate
                            * portalInwardGate
                            * portalAudioGate
                            * (0.34 + anatomyThroatGate * 0.86);

  // Single-sample anatomy scalars: route trap energy into masks (structure), not global tint.
  float fractalMacroContour = clamp(
    portalMandel.boundary * (0.55 + portalMandel.ringMask * 0.62)
    + portalMandel.ringMask * portalMandel.boundary * 0.28,
    0.0,
    1.0
  );
  float fractalMesoLattice = clamp(portalMandel.lineMask * portalMandel.ringMask, 0.0, 1.0)
    * (0.40 + anatomyThroatGate * 0.60);
  float fractalMicroShimmer = portalMandel.pointMask;
  float fractalMicroAuthority = fractalMicroShimmer
    * pow(max(fractalMesoLattice, 1e-5), 1.08)
    * smoothstep(0.02, 0.52, fractalMacroContour)
    * smoothstep(0.06, 0.92, anatomyThroatGate);
  fractalMicroAuthority = pow(clamp(fractalMicroAuthority, 0.0, 1.0), 1.12);

  // Per-mode trap emphasis. Each Mandelbrot trap channel is routed to one
  // tunnel role; mDrift/mGills/.. were hoisted above for motion multipliers.
  float ribWeight      = 0.84 + mGills  * 1.16 + mSpiral * 0.54;
  float ringWeight     = 0.76 + mSpiral * 1.30 + mPulse  * 0.50 + mDrift * 0.34;
  float latticeWeight  = 0.48 + mOrbit  * 1.05 + mGills  * 0.26;
  float membraneWeight = 0.54 + mPulse  * 0.92 + mDrift  * 0.62;

  // Ribs: line trap → rib lattice corridors (contour-linked so ribs aren't a flat overlay).
  float mandelRibs     = portalStructureMask * portalMandel.lineMask  * ribWeight
                       * (0.32 + tunDepth * 0.60)
                       * (1.0 + (midSlide * 0.35 + fluxShimmer * 0.18) * (1.0 - portalQuiet * 0.88))
                       * mix(0.78, 1.16, pow(max(fractalMacroContour, 1e-4), 0.82) * (0.28 + anatomyThroatGate * 0.72));
  // Rings: ring trap → concentric forward-depth bands.
  // bassPunch (A.y) compresses ring amplitude on kicks; Pulse mode adds a throat pump.
  float ringRibBreak = mix(0.32, 1.0, clamp(portalMandel.lineMask * 0.72 + tunnelI * 0.38, 0.0, 1.0));
  float ringDepthPhase = polarTwarp.z * (2.55 + tunSpiral * 1.36) - polarT.y * (4.4 + tunGills * 4.4)
                       + bassBounce * 1.65 * (1.0 - portalQuiet * 0.92) + midSlide * 0.95 * (1.0 - portalQuiet * 0.92);
  float ringDepthBreak = 0.34 + 0.66 * pow(0.5 + 0.5 * sin(ringDepthPhase), 3.10);
  ringDepthBreak *= mix(0.90, 1.14, fractalMesoLattice);
  // Single composition authority: loud colour only where portal anatomy agrees.
  float portalAnatomyAuthority = clamp(
    portalStructureMask * 0.35 +
    anatomyThroatGate * 0.25 +
    ringDepthBreak * 0.18 +
    fractalMacroContour * 0.14 +
    fractalMesoLattice * 0.08,
    0.0,
    1.0
  );
  float anatomyAuthShaped = smoothstep(0.10, 0.78, portalAnatomyAuthority);
  float ringStructureMask = ringRibBreak * ringDepthBreak * mix(0.62, 1.0, anatomyThroatGate);
  float mandelRings    = portalStructureMask * portalMandel.ringMask  * ringWeight
                       * (0.28 + tunInward * 0.50 + tunSpiral * 0.30)
                       * ringStructureMask
                       * (1.0 + uAudioDriveA.y * 1.10 * (1.0 - portalQuiet * 0.88) + uAudioDriveB.y * 0.48 * ringRibBreak * (1.0 - portalQuiet * 0.88))
                       * (1.0 + pulseThroatPump * (1.0 - portalQuiet * 0.85));
  // Lattice glints: point trap → sparse psytrance pinpoints. Gated on highSparkle AND
  // a coincident fluxPulse so the lane only twinkles on transient events.
  float latticeGateRaw = smoothstep(0.18, 0.62, uAudioDriveA.w) * smoothstep(0.04, 0.30, uAudioDriveB.y);
  float latticeGate    = latticeGateRaw * (0.45 + anatomyThroatGate * 0.55) * (1.0 - portalQuietDeep * 0.98);
  float mandelLattice  = portalStructureMask * fractalMicroAuthority * latticeWeight * latticeGate;
  // Membrane glow: boundary-driven — gated so it tracks tissue, not a full-frame sheet.
  float membraneContour = pow(portalMandel.boundary, 1.18);
  float membraneAnatomyMask = mix(0.26, 1.0, pow(max(fractalMacroContour, 1e-4), 0.72) * (0.32 + anatomyThroatGate * 0.68));
  float mandelMembrane = portalStructureMask * membraneContour * membraneWeight
                       * (0.32 + tunBreath * 0.58 + uAudioDriveB.x * 0.40 * (1.0 - portalQuiet * 0.82)) * membraneAnatomyMask;
  // Void: dark interior, kept as multiplicative attenuation.
  float mandelVoid     = portalStructureMask * portalMandel.inside    * (0.050 + tunInward * 0.030);
  vec3 mandelPortalTint = mandelPalette(
    portalMandel.smoothIter + polarTwarp.z * 0.075 + forwardMid * 0.18 + layerCycle * 0.34
      + mix(uAudioDriveA.z * 0.28, forwardSlow * 0.022 + polarTwarp.z * 0.004, portalQuiet),
    phaseHeat + uSpectralCentroid * mix(0.20, 0.09, portalQuiet)
      + uAudioDriveB.y * 0.38 * (1.0 - portalQuiet * 0.75) + uAudioDriveB.x * 0.26 * (1.0 - portalQuiet * 0.70)
  );
  float tunnelGrowthWave = growthWaveBand(polarT.x, growthAge, growthAmp, 0.17) * (0.40 + tunGills * 0.60);
  // vortexLattice twisted by midMotion + coreFlow — wall torsion feels driven by mids
  float vortexMidDrive = mix(uAudioDriveA.z, tunSpiral * 0.55 + forwardMid * 0.05, portalQuiet);
  float vortexLattice = neuralBloom
                      * pow(0.5 + 0.5 * sin(polarTwarp.z * (4.7 + tunSpiral * 1.6 + vortexMidDrive * 3.5) - polarT.y * 5.4 + tBase * 0.34 + forwardMid * 1.20), 3.45)
                      * smoothstep(0.10, 0.82, tunInward + tunSpiral * 0.55)
                      * smoothstep(0.05, 1.08, polarT.x)
                      * (1.0 - smoothstep(1.10, 1.95, polarT.x));
  float fluidMembraneLift = organicTunnel
                          * (0.34 + calmMotion * 0.36 + tunBreath * 0.30)
                          * (0.5 + 0.5 * sin(polarTwarp.z * 1.35 + tBase * 0.20 + forwardSlow * 0.50))
                          * smoothstep(0.12, 1.24, polarT.x)
                          * (1.0 - smoothstep(1.18, 2.04, polarT.x));
  const float WALL_CELL_SCALE = 1.8;
  const float WALL_CELL_DEPTH_SCALE = 1.1;
  float wallCells = cellularEdge(fieldUV * (WALL_CELL_SCALE + tunDepth * WALL_CELL_DEPTH_SCALE) + vec2(polarTwarp.z * 0.055 + forwardFast * 0.06, -tBase * 0.045), tBase * 0.12 + polarTwarp.z * 0.04);
  float wallCellStructureGate = max(smoothstep(0.16, 0.76, tunnelI) * organism.environment, portalStructureMask);
  float wallCellDepthGate = hitDist > 0.0 ? (0.26 + organism.membrane * 0.18) : smoothstep(0.50, 0.14, depth01) * (0.28 + organism.environment * 0.72);
  // Pressure-field routing: blob body/gill/coreFlow → tunnel density/ribs/torsion
  float bpBodyBoost = 1.0 + bp.bodyMask * 0.6;
  float bpGillBoost = 1.0 + bp.gillField * 0.8;
  float bpFlowBoost = 1.0 + bp.coreFlow * 0.6 * uAudioDriveA.z;
  // subBody (A.x) now lives in forwardSlow; keep the pressure-source breath only here.
  float bpBreathBoost = 1.0 + bp.breath * 0.4;
  tunnelI += wallCells * wallCellStructureGate * wallCellDepthGate * tunDepth * (0.020 + uAudioDetail * 0.018) * bpBodyBoost
           + tunnelGrowthWave * 0.60 * bpBreathBoost
           + vortexLattice * (0.16 + bloomEnergy * 0.14) * bpFlowBoost
           + fluidMembraneLift * (0.056 + organism.environment * 0.048)
           + mandelRibs    * tunDepth * (0.165 + uAudioDetail * 0.072)
           + mandelRings   * (0.115 + uAudioDriveA.y * 0.078 + uAudioDriveB.y * 0.040)
           + mandelMembrane * (0.040 + organism.environment * 0.030);
  float hueDepth = polarTwarp.z * 0.075
                 + forwardSlow * 0.14
                 + (mSpiral - mDrift) * 0.12
                 + uAudioDriveA.z * 0.14;
  vec3 tunnelTint = zoneColor(0.34 + hueDepth + tunGills * 0.05 + layerCycle * 0.52, vec3(0.00, 0.90, 1.00), 0.58, 1.48);
  vec3 tunnelDeep = deepColor(0.70 + polarTwarp.z * 0.018 + layerCycle * 0.22, vec3(0.00, 0.035, 0.075));
  tunnelTint = mix(tunnelDeep, tunnelTint, smoothstep(0.05, 0.92, tunnelI));
  tunnelTint = saturateNeon(tunnelTint, 1.82) * 1.38;
  mandelPortalTint = saturateNeon(mandelPortalTint, 1.42) * 1.12;
  mandelPortalTint *= mix(0.35, 1.0, anatomyAuthShaped);
  vec3 portalGold = zoneColor(0.76 + polarTwarp.z * 0.075 + layerCycle * 0.34, vec3(1.00, 0.84, 0.04), 0.70, 2.05);
  vec3 portalAcid = zoneColor(0.92 + polarTwarp.z * 0.065 + shimmerCycle * 0.050, vec3(0.38, 1.00, 0.08), 0.68, 2.12);
  vec3 portalTint = mix(portalGold, portalAcid, smoothstep(0.36, 0.90, phaseHeat + growthAmp * 0.30));
  vec3 waveTint = zoneColor(0.83 + shimmerCycle * 0.070 + growthAge * 0.18, vec3(0.68, 1.00, 0.08), 0.64, 1.68);
  // Tunnel paints through the dissolved blob at near-full strength.
  // Hit branch: only mildly damped on solid core; boosted where rim/throat is strong.
  float tunnelBlobMask = hitDist > 0.0
    ? clamp((0.98 + organism.throat * 0.62 + organism.gill * 0.18 - silhouetteSoft * 0.10) * (0.92 + organism.rim * 0.26), 0.0, 1.55)
    : clamp(
        mix(0.05, 0.16, anatomyAuthShaped)
          + portalMask * smoothstep(0.10, 0.58, tunnelI) * (0.08 + ringDepthBreak * 0.14)
          + smoothstep(0.12, 0.78, edgeProximity) * 0.38
          + organism.throat * 0.72
          + organism.environment * 0.16,
        0.0,
        1.05
      );
  float tunnelRimAtten = mix(1.0, 0.54, smoothstep(0.0, 1.55, length(tunnelUV)));
  float tunnelGain = 1.14 + tunDepth * 1.05 + organism.environment * 0.16 + organism.throat * 0.36 + uAudioDriveB.x * 0.40;
  float missTunnelBright = hitDist > 0.0 ? 1.0 : mix(0.28, 1.0, anatomyAuthShaped);
  if (hitDist <= 0.0) {
    col *= mix(0.18, 1.0, anatomyAuthShaped);
    float missLuma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(missLuma), col, mix(0.58, 1.0, anatomyAuthShaped));
  }
  col *= 1.0 - mandelVoid * tunnelBlobMask * (0.72 + (1.0 - anatomyAuthShaped) * 0.14);
  col += tunnelTint * tunnelI * tunnelBlobMask * tunnelRimAtten * tunnelGain * missTunnelBright;
  col += portalTint * portalI * tunnelBlobMask * (0.62 + anatomyThroatGate * 0.68) * (1.0 + uAudioDriveA.y * 1.20) * (1.0 - uAudioDriveB.w * 0.36) * missTunnelBright;
  // Mandelbrot trap-routed tunnel color: membrane follows contour; ribs/rings stay depth-gated.
  col += mandelPortalTint * mandelMembrane * tunnelBlobMask
       * (0.26 + anatomyThroatGate * 0.44) * (0.32 + uAudioDriveB.x * 0.48 + phaseHeat * 0.14);
  col += mandelPortalTint * mandelRibs * tunnelBlobMask * tunnelRimAtten
       * (0.74 + tunDepth * 0.30 + uAudioDetail * 0.18 + uAudioDriveB.y * 0.50);
  col += mix(tunnelTint, portalGold, 0.32) * mandelRings * tunnelBlobMask * tunnelRimAtten
       * (0.62 + uAudioDriveA.y * 0.30 + uAudioDriveB.y * 0.20);
  col += portalAcid * clamp(mandelLattice, 0.0, 0.85) * tunnelBlobMask
       * (0.22 + uAudioDriveA.w * 0.34) * pow(max(anatomyAuthShaped, 0.001), 0.95);
  col += waveTint * tunnelGrowthWave * tunnelBlobMask * tunnelRimAtten * (0.32 + phaseHeat * 0.22) * bpBreathBoost * mix(0.55, 1.0, anatomyAuthShaped);
  // Drift mode: fluidMembraneLift boosted by coreFlow + midMotion for liquid membrane feel
  float driftWeight = clamp(1.0 - max(max(uModeBlend.x, uModeBlend.y), max(uModeBlend.z, uModeBlend.w)), 0.0, 1.0);
  col += tunnelTint * fluidMembraneLift * tunnelBlobMask * tunnelRimAtten * (0.078 + driftWeight * 0.20 + bp.coreFlow * 0.12 + uAudioDriveA.z * 0.14 * driftWeight) * missTunnelBright;
  col += zoneColor(0.48 + polarTwarp.z * 0.024 + shimmerCycle * 0.080 + forwardFast * 0.08, vec3(0.08, 0.94, 1.00), 0.54, 1.42)
       * vortexLattice * tunnelBlobMask * tunnelRimAtten * (0.300 + uAudioBrightness * 0.20 + bloomEnergy * 0.120 + uAudioDriveB.y * 0.18)
       * mix(0.22, 1.0, anatomyAuthShaped);

  // ── Organic atmosphere: low-amplitude vapor and depth, never a hard outline ─
  float missMask = hitDist > 0.0 ? 0.0 : 1.0;
  float surfaceMask = hitDist > 0.0 ? (1.0 - silhouetteSoft * 0.82) * smoothstep(0.10, 0.72, depth01) : 0.0;
  float proximityMist = smoothstep(0.08, 0.58, edgeProximity) * (1.0 - smoothstep(0.62, 0.94, edgeProximity));
  float atmosphereMask = vaporMist * atmosphereLift * (
    missMask * depthHaze * (0.010 + atmosphereDensity * 0.005) * (0.36 + organism.environment * 0.64) +
    proximityMist * screenHazeMask * (0.006 + audioAtmosphere * 0.006 + trailPersistence * 0.002) * (0.42 + organism.membrane * 0.38 + organism.throat * 0.20) +
    surfaceMask * (0.004 + audioAtmosphere * 0.003 + engineSurfaceDetail * 0.002) * (0.48 + organism.membrane * 0.52)
  );
  vec3 atmosphereColor = zoneColor(0.62 + fieldDetail * 0.12 + vaporMist * 0.08 + layerCycle * 0.34, vec3(0.24, 0.82, 0.92), 0.38, 1.10)
                       * (0.018 + fieldDetail * 0.006 + afterglowSoft * 0.006);
  // Journey-modulated envelope (was hard-clamped at 0.035) — silence stays calm
  // because atmosphereDensity is gated on audioPresence in useThreeScene.js.
  col += atmosphereColor * clamp(atmosphereMask, 0.0, 0.028 + atmosphereDensity * 0.045)
       * mix(1.0, mix(0.28, 1.0, anatomyAuthShaped), missMask);

  // ── Subsurface proximity glow ─────────────────────────────────────────────
  float proxGlow = exp(-minD * minD * 4.6);
  float proxT    = fbm(fieldUV * 0.28 + vec2(t * 0.05, 0.0)) * 0.4 + fieldDetail * 0.08 + 0.72 + uColorShift * 0.3;
  float proxAnatomy = clamp(organism.throat * 0.46 + organism.rim * 0.26 + organism.gill * 0.22 + organism.membrane * 0.18, 0.0, 1.0);
  float proxMask = hitDist > 0.0 ? (0.26 + proxAnatomy * 0.28) : smoothstep(0.02, 0.92, proxGlow) * (0.12 + audioAtmosphere * 0.12) * (0.42 + proxAnatomy * 0.80);
  float proxPresenceGate = mix(0.32, 1.0, audioPresence);
  col += zoneColor(proxT + 0.15 + layerCycle * 0.28, vec3(0.72, 0.14, 0.95), 0.36, 1.22) * proxGlow * proxMask * (0.018 + uCoreEnergy * 0.036 + audioAtmosphere * 0.010 + bloomEnergy * 0.014) * proxPresenceGate;

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
  float localMask = hitDist > 0.0
    ? 0.44 * (1.0 - silhouetteSoft * 0.46) * (0.36 + organism.membrane * 0.64)
    : smoothstep(0.08, 0.82, proxGlow) * (0.16 + organism.environment * 0.42 + organism.throat * 0.56);
  float procPresenceGate = mix(0.20, 1.0, audioPresence);
  float procStrength = (0.012 + fluxLift * 0.070 + uTreblePulse * 0.010 + uAudioDetail * 0.012 + uAudioTurbulence * 0.012 + engineSurfaceDetail * 0.006 + uAudioDriveB.y * 0.090)
                     * uProcIntensity * localMask * (0.42 + uSurfaceEnergy * 0.50) * procPresenceGate
                     * mix(1.0, mix(0.35, 1.0, anatomyAuthShaped), missMask);
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
  float veinSurfaceMask = hitDist > 0.0 ? 0.28 * (1.0 - silhouetteSoft * 0.78) * (0.34 + organism.membrane * 0.66) : 0.0;
  // Bleed veins into the tunnel/atmosphere region at low amplitude so mycelium
  // reads as off-body strands, not just an overlay on the blob surface.
  float veinTunnelMask = missMask * smoothstep(0.10, 0.72, tunnelI) * tunDepth * (0.05 + organism.environment * 0.12 + organism.gill * 0.05);
  float veinProxGate = smoothstep(0.18, 0.64, proxGlow) * smoothstep(0.50, 0.12, depth01) * (0.28 + organism.membrane * 0.42 + organism.throat * 0.30);
  float veinAtmosphereMask = missMask * veinProxGate * 0.052 + veinTunnelMask;
  float veinPresenceGate = mix(0.22, 1.0, audioPresence);
  float veinPhaseGate = clamp(0.72 + engineSurfaceDetail * 0.62, 0.0, 1.0);
  float veinMask = (veinSurfaceMask + veinAtmosphereMask) * (0.40 + uSurfaceEnergy * 0.34 + myceliumPulse * 0.12) * uProcIntensity * veinPresenceGate * veinPhaseGate;
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
  float energyPresenceGate = mix(0.12, 1.0, clamp(audioPresence + forceEnergySum * 0.65, 0.0, 1.0));
  float energyMask = clamp(forceEnergySum * 0.70 + uSurfaceEnergy * 0.54 + uParticleEnergy * 0.22 + uBassHi * 0.24 + uMidPulse * 0.10 + particleActivity * plasmaCreature * 0.22 + neuralBloom * bloomEnergy * 0.16, 0.0, 1.0) * energyPresenceGate;
  if (energyMask > 0.08) {
    vec2  filUV  = fieldUV * 3.8 + vec2(t * 0.06 + modeBias * 0.08, t * -0.04) + organicAsym * 0.22;
    float filN   = fbm(filUV);
    float filLine = smoothstep(0.54, 0.58, filN) * smoothstep(0.62, 0.58, filN);
    float trapLine = orbitTrapMask(filUV * (0.18 + modeCollapse * 0.04 + modeOrbit * 0.035), tBase * 0.32 + uAudioMorph * 0.9 + modeBias + asymPhase * 0.24);
    float filamentMix = clamp(0.18 + modeCollapse * 0.22 + modeOrbit * 0.12 + myceliumPulse * 0.10 + plasmaCreature * 0.08 + uAudioDetail * 0.14, 0.0, 0.58);
    filLine = mix(filLine, trapLine, filamentMix);
    float filT    = filN * 0.3 + uEnergy * 0.4 + uColorShift * 0.2 + uAudioBrightness * 0.08;
    float filamentSilhouetteMask = hitDist > 0.0 ? (1.0 - silhouetteSoft * 0.68) * (0.34 + organism.membrane * 0.66) : (0.22 + organism.environment * 0.78);
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
  float sparkAnatomy = clamp(organism.gill * 0.46 + organism.rim * 0.24 + organism.throat * 0.22 + organism.membrane * 0.16, 0.0, 1.0);
  col += (uHi * 0.012 + fineSpark) * sparkColor * (0.32 + phaseHeat * 0.24 + sparkAnatomy * 0.54);
  col *= 1.0 - modeCollapse * (0.08 + uAudioBody * 0.06) * (1.0 - smoothstep(0.40, 1.60, length(vUv * 2.0 - 1.0)));
  float exposure = clamp(0.46 + uIntensity * 0.48 + uAudioBrightness * 0.13 + uRms * 0.08 + journeyIntensity * 0.05 - uSilence * 0.11, 0.40, 1.16);
  col *= exposure;

  // ── Vignette ───────────────────────────────────────────────────────────────
  float vig = 1.0 - smoothstep(0.86, 1.85, length(vUv * 2.0 - 1.0)) * 0.55;
  col *= vig;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
