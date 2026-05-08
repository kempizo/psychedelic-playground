// Bin ranges at 44100 Hz / 2048 fftSize = ~21.5 Hz/bin
const RANGES = {
  sub:  [0,   4],    // 0–86 Hz
  bass: [4,   20],   // 86–430 Hz
  mid:  [20,  100],  // 430–2150 Hz
  hi:   [100, 400],  // 2150–8600 Hz
}

function avgRange(data, start, end) {
  let sum = 0
  const len = end - start
  for (let i = start; i < end; i++) sum += data[i]
  return sum / len / 255  // normalize 0–1
}

export function extractBands(dataArray) {
  return {
    sub:  avgRange(dataArray, ...RANGES.sub),
    bass: avgRange(dataArray, ...RANGES.bass),
    mid:  avgRange(dataArray, ...RANGES.mid),
    hi:   avgRange(dataArray, ...RANGES.hi),
  }
}
