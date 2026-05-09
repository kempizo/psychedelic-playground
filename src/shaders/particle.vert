attribute float aAge;
attribute float aLife;
attribute float aType;
attribute float aDepth;

uniform float uPixelRatio;
uniform int   uPaletteFamily;
uniform float uPaletteShift;
uniform float uEnergy;

varying float vAlpha;
varying vec3  vColor;

// Same cosine palette families as psychedelic.frag — must stay in sync
vec3 paletteFamily0(float t) {
  vec3 a = vec3(0.05, 0.08, 0.10);
  vec3 b = vec3(0.38, 0.48, 0.28);
  vec3 c = vec3(1.00, 0.80, 1.20);
  vec3 d = vec3(0.45, 0.25, 0.65);
  return a + b * cos(6.28318 * (c * t + d));
}

vec3 paletteFamily1(float t) {
  vec3 a = vec3(0.10, 0.04, 0.14);
  vec3 b = vec3(0.55, 0.20, 0.45);
  vec3 c = vec3(1.10, 0.70, 1.20);
  vec3 d = vec3(0.95, 0.10, 0.55);
  return a + b * cos(6.28318 * (c * t + d));
}

vec3 fieldPalette(float t) {
  float blend = clamp(float(uPaletteFamily) + uPaletteShift, 0.0, 1.0);
  return mix(paletteFamily0(t), paletteFamily1(t), blend);
}

void main() {
  float life = aLife;
  float age  = aAge;
  float norm = clamp(age / max(life, 0.001), 0.0, 1.0);
  vAlpha = (1.0 - smoothstep(0.0, 1.0, norm)) * aDepth;

  // Palette offset: sparks (type=1) use a brighter rim offset; dust slower
  float typeOffset = aType < 0.5 ? 0.15          // dust: teal region
                   : aType < 1.5 ? 0.35 + uEnergy * 0.15  // spark: greener/brighter
                                 : 0.55;          // droplet: violet shift
  float t = position.x * 0.18 + position.y * 0.12 + 0.72 + typeOffset;
  vColor = fieldPalette(t);

  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  // Depth and type affect size: sparks are small and fast, dust is larger
  float baseSize = aType < 0.5 ? 4.0 : aType < 1.5 ? 2.5 : 3.5;
  gl_PointSize = (baseSize + vAlpha * 2.0) * aDepth * uPixelRatio;
  gl_Position = projectionMatrix * mvPos;
}
