precision highp float;

uniform sampler2D uCurrent;
uniform sampler2D uPrev;
uniform float uDecay;
uniform float uEnergy;
uniform float uBeatPhase;
uniform float uFlow;
uniform float uOnset;
uniform float uTreble;

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

  float prevLuma = dot(prev.rgb, vec3(0.299, 0.587, 0.114));
  float brightFade = mix(1.0, mix(0.91, 0.96, clamp(uTreble, 0.0, 1.0)), smoothstep(0.45, 0.95, prevLuma));
  prev.rgb *= brightFade;

  vec4 mixed = mix(current, prev, uDecay);
  mixed.rgb += current.rgb * uOnset * 0.035 * (1.0 - smoothstep(0.0, 0.8, r2));
  gl_FragColor = mixed;
}
