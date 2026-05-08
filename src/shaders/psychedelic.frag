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

varying vec2 vUv;

// ── Noise helpers ──────────────────────────────────────────────────────────────
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash2(i + vec2(0,0)), f - vec2(0,0)),
        dot(hash2(i + vec2(1,0)), f - vec2(1,0)), u.x),
    mix(dot(hash2(i + vec2(0,1)), f - vec2(0,1)),
        dot(hash2(i + vec2(1,1)), f - vec2(1,1)), u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amp   = 0.5;
  float freq  = 1.0;
  for (int i = 0; i < 6; i++) {
    value += amp * noise(p * freq);
    freq  *= 2.1;
    amp   *= 0.48;
  }
  return value;
}

// ── Organic palette: teal → acid green → deep violet from near-black ──────────
vec3 palette(float t) {
  vec3 a = vec3(0.05, 0.08, 0.10);
  vec3 b = vec3(0.38, 0.48, 0.28);
  vec3 c = vec3(1.00, 0.80, 1.20);
  vec3 d = vec3(0.45, 0.25, 0.65);
  return a + b * cos(6.28318 * (c * t + d));
}

// ── Polar conversion ──────────────────────────────────────────────────────────
vec2 toPolar(vec2 p) {
  float r = length(p);
  float a = atan(p.y, p.x);
  return vec2(r, a);
}

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 p = (vUv * 2.0 - 1.0) * vec2(aspect, 1.0);

  float t = uTime * uSpeed * 0.25;

  // Slow sub-bass camera drift
  p += vec2(sin(uTime * 0.07), cos(uTime * 0.05)) * uSub * 0.12;

  // Mode 1: polar coordinates
  if (uMode == 1) {
    vec2 pol = toPolar(p);
    p = vec2(pol.x * 1.2, pol.y / 3.14159);
  }

  // Domain warp — two layers (IQ technique)
  float chaos = uChaos * 1.8 + 0.2;
  vec2 q = vec2(
    fbm(p + t),
    fbm(p + vec2(1.7, 9.2) + t * 0.8)
  );
  vec2 r = vec2(
    fbm(p + chaos * q + vec2(1.7, 9.2) + uBass * 0.6),
    fbm(p + chaos * q + vec2(8.3, 2.8) + uBass * 0.6)
  );

  // Base field value — mid drives distortion strength
  float f = fbm(p + (1.0 + uMid * 2.5) * r);

  // Color with user shift + hi-freq shimmer
  float tColor = f * 0.5 + 0.5 + uColorShift * 0.4 + uHi * 0.12;
  vec3 col = palette(tColor);

  // Bass pulse: brighten + expand on kick
  col += uBass * 0.35 * vec3(0.1, 0.4, 0.3);

  // Hi shimmer
  col += uHi * 0.2 * vec3(0.0, 0.6, 0.5);

  // Intensity scale (emerges from black)
  float baseIntensity = 0.6 + uIntensity * 0.4;
  col *= baseIntensity * (0.5 + f * 0.8);

  // Vignette
  float vig = 1.0 - smoothstep(0.5, 1.4, length(vUv * 2.0 - 1.0));
  col *= vig;

  col = clamp(col, 0.0, 1.0);
  gl_FragColor = vec4(col, 1.0);
}
