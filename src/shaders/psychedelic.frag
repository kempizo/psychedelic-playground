precision highp float;

uniform float uTime;
uniform vec2  uResolution;
uniform float uBass;
uniform float uMid;
uniform float uHi;
uniform float uSub;
uniform float uSpeed;
uniform float uIntensity;
uniform float uColorShift;
uniform float uChaos;
uniform int   uMode;
uniform vec2  uMouse;
uniform float uMouseVel;
uniform vec4  uPulses[8];
uniform float uColorSpike;
uniform float uDistortionSpike;

varying vec2 vUv;

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

// 6-octave 2D FBM (background + color sampling)
float fbm(vec2 p) {
  float v = 0.0, a = 0.5, f = 1.0;
  for (int i = 0; i < 6; i++) { v += a * noise(p * f); f *= 2.1; a *= 0.48; }
  return v;
}

// 3-octave 3D FBM (SDF surface displacement — budget-conscious)
float fbm3(vec3 p) {
  float v = 0.0, a = 0.5, f = 1.0;
  for (int i = 0; i < 3; i++) { v += a * noise3(p * f); f *= 2.1; a *= 0.45; }
  return v;
}

// ── Palette: teal → acid green → deep violet (unchanged) ──────────────────────
vec3 palette(float t) {
  vec3 a = vec3(0.05, 0.08, 0.10);
  vec3 b = vec3(0.38, 0.48, 0.28);
  vec3 c = vec3(1.00, 0.80, 1.20);
  vec3 d = vec3(0.45, 0.25, 0.65);
  return a + b * cos(6.28318 * (c * t + d));
}

// ── SDF: organic blob ──────────────────────────────────────────────────────────
// Trig warp handles shape (free) + one FBM layer for surface bumpiness.
// Multiplied by 0.7 as Lipschitz correction (conservative — prevents over-step).
float sdfBlob(vec3 p, float t, float bass, float mid, float chaos) {
  float warp = chaos * 1.4 + 0.3;
  vec3 q = p + warp * 0.35 * vec3(
    sin(p.y * 2.1 + t * 1.1) + cos(p.z * 1.7 + t * 0.8),
    cos(p.x * 1.9 + t * 0.7) + sin(p.z * 2.3 + t * 1.2),
    sin(p.x * 1.5 + t * 0.9) + cos(p.y * 2.7 + t * 0.6)
  );
  float disp = fbm3(q * 1.2 + t * 0.15) * (0.28 + mid * 0.40 + bass * 0.18);
  return (length(q) - (0.85 + bass * 0.28 + disp)) * 0.70;
}

// Forward-difference normals: 4 SDF evals (vs 6 for central differences)
vec3 calcNormal(vec3 p, float t, float bass, float mid, float chaos) {
  float eps = 0.012;
  float c = sdfBlob(p, t, bass, mid, chaos);
  return normalize(vec3(
    sdfBlob(p + vec3(eps, 0.0, 0.0), t, bass, mid, chaos) - c,
    sdfBlob(p + vec3(0.0, eps, 0.0), t, bass, mid, chaos) - c,
    sdfBlob(p + vec3(0.0, 0.0, eps), t, bass, mid, chaos) - c
  ));
}

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2  sUV    = (vUv * 2.0 - 1.0) * vec2(aspect, 1.0);
  float t      = uTime * uSpeed * 0.18;

  // ── NDC position for pulse evaluation (un-aspect-corrected) ───────────────
  vec2 ndcUV = vUv * 2.0 - 1.0;

  // ── Pulse ring field ──────────────────────────────────────────────────────
  vec2  pulseWarp = vec2(0.0);
  float pulseGlow = 0.0;
  for (int i = 0; i < 8; i++) {
    vec4  pu = uPulses[i];
    if (pu.w < 0.001) continue;
    vec2  toFrag = ndcUV - pu.xy;
    float dist   = length(toFrag);
    float d2     = (dist - pu.z) / 0.10;
    float ring   = exp(-d2 * d2) * pu.w;
    pulseWarp   += ring * normalize(toFrag + vec2(0.0001)) * 0.12;
    pulseGlow   += ring;
  }
  pulseGlow = clamp(pulseGlow, 0.0, 1.0);
  sUV += pulseWarp;

  // ── Virtual camera ─────────────────────────────────────────────────────────
  vec3 ro, rd;

  if (uMode == 0) {
    // Fluid: orbit camera outside the blob
    float orbit = t * 0.55 + uSub * 0.8;
    float tilt  = cos(t * 0.30) * 0.55;
    float dist  = 2.8 - uBass * 0.55;

    ro = vec3(sin(orbit) * dist, tilt + uMouse.y * 0.45, cos(orbit) * dist);
    vec3 target  = vec3(uMouse.x * 0.45, uMouse.y * 0.25, 0.0);
    vec3 fwd     = normalize(target - ro);
    vec3 worldUp = abs(fwd.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 right   = normalize(cross(fwd, worldUp));
    vec3 up      = cross(right, fwd);
    rd = normalize(fwd + sUV.x * right * 0.65 + sUV.y * up * 0.65);

  } else {
    // Radial: close macro orbit — clips through surface on bass, cave-like
    float orbit2 = t * 0.80 + uSub * 0.6;
    float dist2  = 1.2 - uBass * 0.30;
    ro = vec3(sin(orbit2) * dist2,
              cos(t * 0.35) * dist2 * 0.55 + uMouse.y * 0.35,
              cos(orbit2) * dist2);
    vec3 fwd2     = normalize(-ro);
    vec3 worldUp2 = abs(fwd2.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 right2   = normalize(cross(fwd2, worldUp2));
    vec3 up2      = cross(right2, fwd2);
    rd = normalize(fwd2 + sUV.x * right2 * 0.75 + sUV.y * up2 * 0.75);
  }

  // ── Sphere tracer (40 steps) ───────────────────────────────────────────────
  float tRay   = 0.08;
  float hitDist = -1.0;
  float minD    = 100.0;

  for (int i = 0; i < 40; i++) {
    vec3  p = ro + rd * tRay;
    float d = sdfBlob(p, t, uBass, uMid, uChaos) + pulseGlow * 0.03;
    minD = min(minD, abs(d));
    if (abs(d) < 0.006) { hitDist = tRay; break; }
    tRay += max(abs(d) * 0.55, 0.015);
    if (tRay > 10.0) break;
  }

  vec3 col = vec3(0.0);

  if (hitDist > 0.0) {
    // ── Surface: diffuse + Fresnel rim ──────────────────────────────────────
    vec3  p    = ro + rd * hitDist;
    vec3  nrm  = calcNormal(p, t, uBass, uMid, uChaos);
    vec3  lDir = normalize(vec3(sin(t * 0.35) * 1.2, 0.8, cos(t * 0.35) * 1.2));

    float diff    = max(0.0, dot(nrm, lDir)) * 0.65 + 0.18;
    float fresnel = pow(1.0 - abs(dot(nrm, -rd)), 2.5);

    // Palette bias fix: 0.4 * v + 0.72 centers on acid-green, avoids red zone
    float noiseV = fbm3(p * 0.55 + t * 0.08);
    float ct     = noiseV * 0.4 + 0.72 + uColorShift * 0.4 + uHi * 0.10;

    col  = palette(ct) * diff;
    col += palette(ct + 0.32) * fresnel * (0.75 + uHi * 0.65);
    col += palette(ct + 0.50) * 0.06;
    col += uBass * 0.30 * vec3(0.08, 0.38, 0.28);

  } else {
    // ── Volumetric glow: near-miss rays accumulate fog ───────────────────────
    float glow = exp(-minD * 3.5) * 0.65;
    float bgT  = fbm(sUV * 0.35 + vec2(t * 0.06, 0.0)) * 0.4 + 0.72 + uColorShift * 0.3;
    col  = palette(bgT) * glow * (0.45 + uBass * 0.55);
    col += palette(bgT + 0.50) * 0.07;
  }

  // ── Pulse ring color overlay ──────────────────────────────────────────────
  col += vec3(0.0, 0.72, 0.85) * pulseGlow * (0.8 + uColorSpike * 0.5);
  col += palette(t * 0.4 + 0.5) * uColorSpike * 0.25;

  // ── Mouse energy ripple ────────────────────────────────────────────────────
  float mDist = length(sUV - uMouse);
  col += palette(t * 0.4 + 0.5) * exp(-mDist * 2.5) * uMouseVel * 0.55;

  // ── Hi shimmer + intensity ─────────────────────────────────────────────────
  col += uHi * 0.14 * vec3(0.0, 0.75, 0.60);
  col *= 0.55 + uIntensity * 0.65;

  // ── Vignette ───────────────────────────────────────────────────────────────
  float vig = 1.0 - smoothstep(0.40, 1.35, length(vUv * 2.0 - 1.0));
  col *= vig;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
