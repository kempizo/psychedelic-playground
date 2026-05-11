const PERCEPTUAL_RANGES = {
  sub: [20, 80],
  bass: [80, 120],
  lowMid: [120, 400],
  mid: [400, 2000],
  highMid: [2000, 6000],
  treble: [6000, 16000],
}

function hzToBin(hz, sampleRate, fftSize, length) {
  const bin = Math.round((hz / sampleRate) * fftSize)
  return Math.max(0, Math.min(length, bin))
}

function binRange(data, hzRange, sampleRate, fftSize) {
  const nyquist = sampleRate / 2
  const startHz = Math.max(0, Math.min(nyquist, hzRange[0]))
  const endHz = Math.max(startHz, Math.min(nyquist, hzRange[1]))
  const start = hzToBin(startHz, sampleRate, fftSize, data.length)
  const end = Math.max(start + 1, hzToBin(endHz, sampleRate, fftSize, data.length))
  return [start, Math.min(end, data.length)]
}

function avgRange(data, start, end) {
  let sum = 0
  const len = Math.max(1, end - start)
  for (let i = start; i < end; i++) sum += data[i]
  return sum / len / 255  // normalize 0–1
}

const FLOOR = 0.05

function applyFloorAndCurve(v, curve = 1.35) {
  const floored = Math.max(0, v - FLOOR)
  return Math.min(1, Math.pow(floored, curve))
}

function spectralCentroid(data, sampleRate, fftSize) {
  let weighted = 0
  let total = 0
  const end = binRange(data, [20, 16000], sampleRate, fftSize)[1]

  for (let i = 0; i < end; i++) {
    const mag = Math.max(0, data[i] - 3)
    const hz = (i * sampleRate) / fftSize
    weighted += hz * mag
    total += mag
  }

  if (total < end * 1.5) return 0
  return Math.max(0, Math.min(1, (weighted / total) / 16000))
}

function spectralFlux(data, previous, sampleRate, fftSize) {
  if (!previous || previous.length !== data.length) return 0

  let sum = 0
  const end = binRange(data, [20, 16000], sampleRate, fftSize)[1]
  for (let i = 0; i < end; i++) {
    sum += Math.max(0, data[i] - previous[i])
  }

  const normalized = sum / end / 255
  return Math.pow(Math.max(0, normalized * 5.0 - 0.01), 0.8)
}

function waveformRms(waveform) {
  if (!waveform || waveform.length === 0) return 0
  let sum = 0
  for (let i = 0; i < waveform.length; i++) {
    const centered = (waveform[i] - 128) / 128
    sum += centered * centered
  }
  return Math.min(1, Math.sqrt(sum / waveform.length) * 1.8)
}

export function extractBands(dataArray, previousData = null, {
  sampleRate = 44100,
  fftSize = 2048,
  waveform = null,
} = {}) {
  const raw = {}
  for (const [key, range] of Object.entries(PERCEPTUAL_RANGES)) {
    raw[key] = avgRange(dataArray, ...binRange(dataArray, range, sampleRate, fftSize))
  }

  const sub = applyFloorAndCurve(raw.sub, 1.25)
  const bass = applyFloorAndCurve(raw.bass, 1.20)
  const lowMid = applyFloorAndCurve(raw.lowMid, 1.35)
  const mid = applyFloorAndCurve(raw.mid, 1.40)
  const highMid = applyFloorAndCurve(raw.highMid, 1.45)
  const treble = applyFloorAndCurve(raw.treble, 1.55)
  const hi = Math.min(1, highMid * 0.70 + treble * 0.55)
  const rms = waveformRms(waveform)
  const energyFloor = sub + bass + lowMid + mid + highMid + treble + rms

  return {
    sub,
    bass,
    lowMid,
    mid,
    highMid,
    treble,
    hi,
    rms,
    silence: energyFloor < 0.035 ? 1 : 0,
    spectralCentroid: spectralCentroid(dataArray, sampleRate, fftSize),
    spectralFlux: spectralFlux(dataArray, previousData, sampleRate, fftSize),
  }
}
