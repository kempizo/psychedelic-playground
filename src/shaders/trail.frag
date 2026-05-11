precision highp float;

uniform sampler2D uCurrent;
uniform sampler2D uPrev;
uniform float uDecay;
uniform float uEnergy;
uniform float uBeatPhase;

varying vec2 vUv;

void main() {
  vec4 current = texture2D(uCurrent, vUv);
  vec2 center = vUv - 0.5;
  float beatWave = sin(uBeatPhase * 6.28318);
  vec2 drift = vec2(-center.y, center.x) * (0.0015 + uEnergy * 0.0035) * beatWave
             + center * uEnergy * 0.0015;
  vec4 prev = texture2D(uPrev, vUv + drift);

  float prevLuma = dot(prev.rgb, vec3(0.299, 0.587, 0.114));
  float brightFade = mix(1.0, 0.93, smoothstep(0.45, 0.95, prevLuma));
  prev.rgb *= brightFade;

  gl_FragColor = mix(current, prev, uDecay);
}
