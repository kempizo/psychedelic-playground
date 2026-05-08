precision highp float;

uniform sampler2D uCurrent;
uniform sampler2D uPrev;
uniform float uDecay;

varying vec2 vUv;

void main() {
  vec4 current = texture2D(uCurrent, vUv);
  vec4 prev    = texture2D(uPrev, vUv);
  gl_FragColor = mix(current, prev, uDecay);
}
