import { resumeContext, connectSource } from './analyser'

let activeSource = null

export async function connectFile(file) {
  const ctx = resumeContext()
  const arrayBuffer = await file.arrayBuffer()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)

  if (activeSource) {
    try { activeSource.stop() } catch {}
  }

  activeSource = ctx.createBufferSource()
  activeSource.buffer = audioBuffer
  activeSource.loop = true
  connectSource(activeSource)
  activeSource.start(0)
  return activeSource
}

export function stopFile() {
  if (activeSource) {
    try { activeSource.stop() } catch {}
    activeSource = null
  }
}
