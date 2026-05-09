export function startRecording(canvas, durationMs = 8000, onProgress, onDone) {
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm'

  const stream = canvas.captureStream(30)
  const recorder = new MediaRecorder(stream, { mimeType })
  const chunks = []

  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `psychedelic-${Date.now()}.webm`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
    onDone?.()
  }

  recorder.start()

  const startTime = performance.now()
  let rafId

  const tick = () => {
    const elapsed = performance.now() - startTime
    const progress = Math.min(elapsed / durationMs, 1)
    onProgress?.(progress)
    if (elapsed >= durationMs) {
      recorder.stop()
      return
    }
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)

  return () => {
    cancelAnimationFrame(rafId)
    if (recorder.state !== 'inactive') recorder.stop()
  }
}
