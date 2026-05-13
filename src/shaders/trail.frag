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
  vec2 drift = curlish * (0.0008 + uEnergy * 0.0014 + uFlow * 0.0028) * beatWave * 0.55
             + center * (uEnergy * 0.0007 + uOnset * 0.0012) * (1.0 - smoothstep(0.05, 0.7, r2));
  vec4 prev = texture2D(uPrev, vUv + drift);

  float currentLuma = dot(current.rgb, vec3(0.299, 0.587, 0.114));
  float prevLuma = dot(prev.rgb, vec3(0.299, 0.587, 0.114));
  float brightFade = mix(1.0, mix(0.91, 0.96, clamp(uTreble, 0.0, 1.0)), smoothstep(0.45, 0.95, prevLuma));
  prev.rgb *= brightFade;

  float edgeDelta = length(current.rgb - prev.rgb);
  float edge = smoothstep(0.10, 0.68, edgeDelta);
  float hardEdge = smoothstep(0.32, 0.74, edgeDelta);
  float trailEdgeEnergy = smoothstep(0.18, 0.70, uEnergy + uOnset * 0.34 + uTreblePulse * 0.24 + uAudioDetail * 0.18);
  // Orphan trail: halved to reduce isolated bright-pixel persistence.
  float orphanTrail = smoothstep(0.024, 0.20, prevLuma) * (1.0 - smoothstep(0.010, 0.14, currentLuma)) * (0.29 + trailEdgeEnergy * 0.11);
  // Chroma separation gated by audio peaks (onset + treble pulse) so the
  // fringe only appears during transients, not constantly.
  float chromaGate = smoothstep(0.18, 0.55, uOnset + uTreblePulse * 0.5);
  float chromaEnergy = clamp(uAudioDetail * 0.12 + uAudioTurbulence * 0.16 + uTreblePulse * 0.08, 0.0, 1.0) * (0.14 + trailEdgeEnergy * 0.18) * chromaGate;
  float shearMask = smoothstep(0.07, 0.42, edgeDelta) * (1.0 - hardEdge * 0.92);
  float shearPhase = sin((center.x - center.y) * 13.0 + uBeatPhase * 6.28318 + swirl * 0.35);
  vec3 shear = vec3(prev.g - prev.b, prev.b - prev.r, prev.r - prev.g);
  prev.rgb *= mix(1.0, 0.42, orphanTrail);
  prev.rgb *= mix(1.0, 0.62, hardEdge * (0.46 + trailEdgeEnergy * 0.20 + uOnset * 0.08));
  prev.rgb *= mix(1.0, 0.84, edge * (0.20 + trailEdgeEnergy * 0.16));
  prev.rgb += shear * shearMask * chromaEnergy * shearPhase * 0.004;

  // Luminance-aware: bright pixels kick decay DOWN so peak hits clear in
  // ~6 frames instead of smearing for 16. Atmospheric midtones still persist.
  float lumKick = smoothstep(0.55, 0.95, prevLuma);
  float localDecay = uDecay * mix(1.0, 0.66, lumKick);
  localDecay *= mix(1.0, 0.74, edge * (0.42 + trailEdgeEnergy * 0.16));
  localDecay *= mix(1.0, 0.50, hardEdge * (0.56 + trailEdgeEnergy * 0.16));
  localDecay *= mix(1.0, 0.48, orphanTrail);
  vec4 mixed = mix(current, prev, localDecay);
  mixed.rgb += current.rgb * uOnset * 0.018 * (1.0 - smoothstep(0.0, 0.8, r2));
  gl_FragColor = vec4(clamp(mixed.rgb, 0.0, 1.0), 1.0);
}
