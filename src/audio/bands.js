// Bin ranges at 44100 Hz / 2048 fftSize = ~21.5 Hz/bin
const RANGES = {
  sub:  [0,   4],    // 0–86 Hz
  bass: [4,   20],   // 86–430 Hz
  mid:  [20,  100],  // 430–2150 Hz
  hi:   [100, 400],  // 2150–8600 Hz
}

const ANALYSIS_END_BIN = RANGES.hi[1]

function avgRange(data, start, end) {
  let sum = 0
  const len = end - start
  for (let i = start; i < end; i++) sum += data[i]
  return sum / len / 255  // normalize 0–1
}

const FLOOR = 0.05

function applyFloorAndCurve(v) {
  const floored = Math.max(0, v - FLOOR)
  return Math.pow(floored, 1.4)
}

function spectralCentroid(data) {
  let weighted = 0
  let total = 0
  const end = Math.min(ANALYSIS_END_BIN, data.length)

  for (let i = 0; i < end; i++) {
    const mag = Math.max(0, data[i] - 3)
    weighted += i * mag
    total += mag
  }

  if (total < end * 1.5) return 0
  return Math.max(0, Math.min(1, (weighted / total) / end))
}

function spectralFlux(data, previous) {
  if (!previous || previous.length !== data.length) return 0

  let sum = 0
  const end = Math.min(ANALYSIS_END_BIN, data.length)
  for (let i = 0; i < end; i++) {
    sum += Math.max(0, data[i] - previous[i])
  }

  const normalized = sum / end / 255
  return Math.pow(Math.max(0, normalized * 5.0 - 0.01), 0.8)
}

export function extractBands(dataArray, previousData = null) {
  return {
    sub:  applyFloorAndCurve(avgRange(dataArray, ...RANGES.sub)),
    bass: applyFloorAndCurve(avgRange(dataArray, ...RANGES.bass)),
    mid:  applyFloorAndCurve(avgRange(dataArray, ...RANGES.mid)),
    hi:   applyFloorAndCurve(avgRange(dataArray, ...RANGES.hi)),
    spectralCentroid: spectralCentroid(dataArray),
    spectralFlux: spectralFlux(dataArray, previousData),
  }
}
