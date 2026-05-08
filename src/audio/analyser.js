let audioCtx = null
let analyserNode = null

export function getAudioContext() {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

export function resumeContext() {
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

export function createAnalyser(fftSize = 2048) {
  const ctx = resumeContext()
  analyserNode = ctx.createAnalyser()
  analyserNode.fftSize = fftSize
  analyserNode.smoothingTimeConstant = 0.75
  return { ctx, analyser: analyserNode }
}

export function connectSource(sourceNode, toSpeakers = false) {
  if (!analyserNode) throw new Error('Call createAnalyser first')
  sourceNode.connect(analyserNode)
  if (toSpeakers) sourceNode.connect(audioCtx.destination)
}

export function getAnalyser() {
  return analyserNode
}

export function destroyAnalyser() {
  if (analyserNode) {
    analyserNode.disconnect()
    analyserNode = null
  }
  if (audioCtx) {
    audioCtx.close()
    audioCtx = null
  }
}
