precision highp float;

uniform sampler2D uCurrent;
uniform sampler2D uPrev;
uniform float uDecay;
uniform float uEnergy;
uniform float uBeatPhase;
uniform float uFlow;
uniform float uOnset;
uniform float uTreble;
uniform float uAudioDetail;
uniform float uAudioTurbulence;
uniform float uTreblePulse;

varying vec2 vUv;

void main() {
  vec4 current = texture2D(uCurrent, vUv);
  vec2 center = vUv - 0.5;
  float beatWave = sin(uBeatPhase * 6.28318);
  float r2 = dot(center, center);
  float swirl = sin((center.x + center.y) * 8.0 + uBeatPhase * 6.28318);
  vec2 tangent = vec2(-center.y, center.x);
  vec2 curlish = normalize(tangent + vec2(swirl * 0.18, -swirl * 0.14) + vec2(0.0001));
  vec2 drift = curlish * (0.0015 + uEnergy * 0.0024 + uFlow * 0.0046) * beatWave
             + center * (uEnergy * 0.0012 + uOnset * 0.0025) * (1.0 - smoothstep(0.05, 0.7, r2));
  vec4 prev = texture2D(uPrev, vUv + drift);

  float currentLuma = dot(current.rgb, vec3(0.299, 0.587, 0.114));
  float prevLuma = dot(prev.rgb, vec3(0.299, 0.587, 0.114));
  float brightFade = mix(1.0, mix(0.91, 0.96, clamp(uTreble, 0.0, 1.0)), smoothstep(0.45, 0.95, prevLuma));
  prev.rgb *= brightFade;

  float edgeDelta = length(current.rgb - prev.rgb);
  float edge = smoothstep(0.090, 0.42, edgeDelta);
  float trailEdgeEnergy = smoothstep(0.16, 0.64, uEnergy + uOnset * 0.60 + uTreblePulse * 0.35 + uAudioDetail * 0.20);
  float orphanTrail = smoothstep(0.018, 0.16, prevLuma) * (1.0 - smoothstep(0.012, 0.10, currentLuma)) * (1.0 - trailEdgeEnergy);
  float chromaEnergy = clamp(uAudioDetail * 0.32 + uAudioTurbulence * 0.44 + uTreblePulse * 0.30, 0.0, 1.0) * trailEdgeEnergy;
  float shearPhase = sin((center.x - center.y) * 13.0 + uBeatPhase * 6.28318 + swirl * 0.35);
  vec3 shear = vec3(prev.g - prev.b, prev.b - prev.r, prev.r - prev.g);
  prev.rgb *= mix(1.0, 0.34, orphanTrail);
  prev.rgb *= mix(1.0, 0.78, edge * (0.22 + trailEdgeEnergy * 0.58 + uOnset * 0.18));
  prev.rgb += shear * edge * chromaEnergy * shearPhase * 0.026;

  float localDecay = uDecay * mix(1.0, 0.64, edge * (0.65 + trailEdgeEnergy * 0.20));
  localDecay *= mix(1.0, 0.38, orphanTrail);
  vec4 mixed = mix(current, prev, localDecay);
  mixed.rgb += current.rgb * uOnset * 0.035 * (1.0 - smoothstep(0.0, 0.8, r2));
  gl_FragColor = vec4(clamp(mixed.rgb, 0.0, 1.0), 1.0);
}
