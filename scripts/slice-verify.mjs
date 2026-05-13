import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg.startsWith('--')) continue;
  const [key, inlineValue] = arg.slice(2).split('=');
  const nextValue = process.argv[i + 1];
  const value = inlineValue ?? (nextValue && !nextValue.startsWith('--') ? nextValue : 'true');
  if (inlineValue === undefined && value === nextValue) i += 1;
  args.set(key, value);
}

const url = args.get('url') ?? 'http://127.0.0.1:5173/';
const out = args.get('out') ?? `screenshots/slice-verify.png`;
const mode = Number.parseInt(args.get('mode') ?? '0', 10);
const wait = Number.parseInt(args.get('wait') ?? '3500', 10);
const width = Number.parseInt(args.get('width') ?? '1440', 10);
const height = Number.parseInt(args.get('height') ?? '900', 10);
const profile = args.get('profile') ?? '';

await fs.mkdir(path.dirname(out), { recursive: true });

const browser = await puppeteer.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});

const errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      errors.push(`${msg.type()}: ${msg.text()}`);
    }
  });
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));

  // Hide LandingScreen splash so canvas is visible (does not start audio,
  // so we view the silence-state shader render).
  await page.addStyleTag({
    content: `.fixed.inset-0.z-10 { display: none !important; }`,
  });

  // Set mode in zustand store if exposed. Falls back gracefully if not.
  if (mode !== 0) {
    await page.evaluate((m) => {
      const store = window.__STORE__;
      if (store?.getState) store.getState().setControl?.('mode', m);
    }, mode);
  }

  if (profile) {
    await page.evaluate((name) => {
      const store = window.__STORE__;
      if (!store?.getState) return;
      clearInterval(window.__SLICE_AUDIO_TIMER__);

      const base = {
        sub: 0,
        bass: 0,
        lowMid: 0,
        mid: 0,
        highMid: 0,
        treble: 0,
        hi: 0,
        rms: 0,
        energy: 0,
        energyEnvelope: 0,
        predictedEnergy: 0,
        onset: 0,
        bassPulse: 0,
        midPulse: 0,
        treblePulse: 0,
        beatPhase: 0,
        beatConfidence: 0,
        latencySec: 0,
        spectralCentroid: 0.42,
        spectralFlux: 0,
        silence: 1,
      };
      const profiles = {
        'idle-mycelium': [
          { duration: 12000, audio: { ...base } },
        ],
        'breathing-organism': [
          { duration: 6000, audio: { ...base, sub: 0.10, bass: 0.12, lowMid: 0.08, mid: 0.08, highMid: 0.04, treble: 0.04, hi: 0.04, rms: 0.12, energy: 0.12, energyEnvelope: 0.12, predictedEnergy: 0.12, onset: 0.02, bassPulse: 0.01, midPulse: 0.01, treblePulse: 0.01, spectralFlux: 0.03, silence: 0.10 } },
        ],
        'gills-portal-pull': [
          { duration: 1600, audio: { ...base, sub: 0.46, bass: 0.76, lowMid: 0.44, mid: 0.42, highMid: 0.18, treble: 0.18, hi: 0.18, rms: 0.42, energy: 0.54, energyEnvelope: 0.54, predictedEnergy: 0.54, onset: 0.18, bassPulse: 0.24, midPulse: 0.18, treblePulse: 0.06, beatConfidence: 0.42, spectralFlux: 0.16, silence: 0.06 } },
          { duration: 6500, audio: { ...base, sub: 0.34, bass: 0.62, lowMid: 0.34, mid: 0.34, highMid: 0.14, treble: 0.14, hi: 0.14, rms: 0.34, energy: 0.42, energyEnvelope: 0.42, predictedEnergy: 0.42, onset: 0.05, bassPulse: 0.10, midPulse: 0.10, treblePulse: 0.04, beatConfidence: 0.35, spectralFlux: 0.08, silence: 0.08 } },
        ],
        'bloom-breakthrough': [
          { duration: 6000, audio: { ...base, sub: 0.70, bass: 0.95, lowMid: 0.80, mid: 0.80, highMid: 0.80, treble: 0.80, hi: 0.80, rms: 0.85, energy: 0.88, energyEnvelope: 0.88, predictedEnergy: 0.92, onset: 0.90, bassPulse: 0.90, midPulse: 0.65, treblePulse: 0.70, beatConfidence: 0.80, spectralCentroid: 0.72, spectralFlux: 0.75, silence: 0.02 } },
        ],
        afterglow: [
          { duration: 4200, audio: { ...base, sub: 0.72, bass: 0.95, lowMid: 0.82, mid: 0.78, highMid: 0.72, treble: 0.70, hi: 0.74, rms: 0.84, energy: 0.88, energyEnvelope: 0.88, predictedEnergy: 0.92, onset: 0.85, bassPulse: 0.85, midPulse: 0.60, treblePulse: 0.58, beatConfidence: 0.78, spectralCentroid: 0.68, spectralFlux: 0.70, silence: 0.02 } },
          { duration: 7000, audio: { ...base, sub: 0.06, bass: 0.08, lowMid: 0.06, mid: 0.06, highMid: 0.03, treble: 0.03, hi: 0.03, rms: 0.08, energy: 0.07, energyEnvelope: 0.07, predictedEnergy: 0.06, onset: 0.0, bassPulse: 0.0, midPulse: 0.0, treblePulse: 0.0, spectralFlux: 0.02, silence: 0.28 } },
        ],
      };
      const sequence = profiles[name] ?? profiles['idle-mycelium'];
      const started = performance.now();
      const applyProfile = () => {
        const elapsed = performance.now() - started;
        let acc = 0;
        let current = sequence[sequence.length - 1].audio;
        for (const step of sequence) {
          acc += step.duration;
          if (elapsed <= acc) {
            current = step.audio;
            break;
          }
        }
        const beatPhase = ((elapsed / 1000) * 1.8) % 1;
        store.getState().setAudioData({ ...current, beatPhase });
      };
      applyProfile();
      window.__SLICE_AUDIO_TIMER__ = setInterval(applyProfile, 50);
    }, profile);
  }

  await new Promise((r) => setTimeout(r, wait));
  await page.screenshot({ path: out });

  const info = await page.evaluate(() => ({
    canvasCount: document.querySelectorAll('canvas').length,
    bodyClass: document.body.className,
    energy: window.__STORE__?.getState?.().energy ?? null,
    behavioralState: window.__STORE__?.getState?.().behavioralState ?? null,
    journeyPhase: window.__JOURNEY_PHASE__ ?? null,
    journeyPhaseMul: window.__JOURNEY_PHASE_MUL__ ?? null,
  }));
  console.log(JSON.stringify({ out, mode, profile, errors, info }, null, 2));
} finally {
  await browser.close();
}
