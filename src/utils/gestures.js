// Gesture detectors operating on a fixed-size ring buffer of mouse positions.
// Each detector returns true exactly once per gesture recognition — callers
// must reset state via the returned reset function if they want re-arm.

const BUFFER_SIZE = 120   // ~2 seconds at 60fps

// Ring buffer of {x, y} NDC mouse positions
let buf = []
let bufHead = 0
let bufFull = false

// Per-session state for detectors that have debounce windows
let lastCircleTime = -Infinity
let lastFigure8Time = -Infinity
let lastIdleTime = -Infinity
let rapidClickTimes = []

// Append a new position to the ring buffer
export function pushMousePos(x, y) {
  if (buf.length < BUFFER_SIZE) {
    buf.push({ x, y })
    if (buf.length === BUFFER_SIZE) bufFull = true
  } else {
    buf[bufHead] = { x, y }
    bufHead = (bufHead + 1) % BUFFER_SIZE
    bufFull = true
  }
}

// Push a raw click timestamp (ms since epoch)
export function pushClickTime(t) {
  rapidClickTimes.push(t)
  // Keep only last 5 clicks to avoid unbounded growth
  if (rapidClickTimes.length > 5) rapidClickTimes.shift()
}

// Return ordered slice of the ring buffer (oldest → newest)
function getOrdered(count) {
  if (!bufFull) {
    const n = Math.min(count, buf.length)
    return buf.slice(buf.length - n)
  }
  const all = []
  for (let i = 0; i < BUFFER_SIZE; i++) {
    all.push(buf[(bufHead + i) % BUFFER_SIZE])
  }
  return count >= BUFFER_SIZE ? all : all.slice(BUFFER_SIZE - count)
}

// Measure total arc length of the last N positions
function arcLength(pts) {
  let len = 0
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x
    const dy = pts[i].y - pts[i - 1].y
    len += Math.sqrt(dx * dx + dy * dy)
  }
  return len
}

// Net signed angular sweep (in radians) around centroid for the last N positions.
// Positive = CCW, negative = CW.
function angularSweep(pts) {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
  let sweep = 0
  for (let i = 1; i < pts.length; i++) {
    const ax = pts[i - 1].x - cx, ay = pts[i - 1].y - cy
    const bx = pts[i].x     - cx, by = pts[i].y     - cy
    // atan2 of the cross product / dot product gives signed angle
    const cross = ax * by - ay * bx
    const dot   = ax * bx + ay * by
    sweep += Math.atan2(cross, dot)
  }
  return sweep
}

// ── Detectors ─────────────────────────────────────────────────────────────────

// Circle: last 90 samples sweep > 1.5 full turns (9.4 rad) and arc > 0.8 NDC.
// Debounced to once per 3 seconds.
export function detectCircle(nowMs) {
  if (!bufFull) return false
  if (nowMs - lastCircleTime < 3000) return false
  const pts = getOrdered(90)
  const arc = arcLength(pts)
  if (arc < 0.8) return false
  const sweep = Math.abs(angularSweep(pts))
  if (sweep > Math.PI * 3.0) {
    lastCircleTime = nowMs
    return true
  }
  return false
}

// Figure-8: look for a sign-reversal in angular sweep midpoint over 100 samples.
// Split into two 50-sample halves; each must sweep > 0.9π and have opposite signs.
// Debounced to once per 4 seconds.
export function detectFigure8(nowMs) {
  if (!bufFull) return false
  if (nowMs - lastFigure8Time < 4000) return false
  const pts = getOrdered(100)
  if (pts.length < 100) return false
  const half = 50
  const first  = pts.slice(0, half)
  const second = pts.slice(half)
  const s1 = angularSweep(first)
  const s2 = angularSweep(second)
  // Opposite rotation in each half, each > ~162 degrees
  if (Math.abs(s1) > Math.PI * 0.9 && Math.abs(s2) > Math.PI * 0.9 && s1 * s2 < 0) {
    lastFigure8Time = nowMs
    return true
  }
  return false
}

// Rapid-click: 4 or more clicks within 1.5 seconds.
export function detectRapidClick(nowMs) {
  // Purge old clicks
  rapidClickTimes = rapidClickTimes.filter(t => nowMs - t < 1500)
  return rapidClickTimes.length >= 4
}

// Idle: no mouse movement (arc < 0.02 NDC over last 120 samples) for 8 seconds.
// Only fires once per 10 seconds to avoid spamming.
export function detectIdle(nowMs) {
  if (nowMs - lastIdleTime < 10000) return false
  if (!bufFull) return false
  const pts = getOrdered(BUFFER_SIZE)
  if (arcLength(pts) < 0.02) {
    lastIdleTime = nowMs
    return true
  }
  return false
}

// Reset all detector state (call when component unmounts)
export function resetGestureState() {
  buf = []
  bufHead = 0
  bufFull = false
  lastCircleTime = -Infinity
  lastFigure8Time = -Infinity
  lastIdleTime = -Infinity
  rapidClickTimes = []
}
