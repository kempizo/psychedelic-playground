import { resumeContext, connectSource } from './analyser'

export async function connectMic() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
  const ctx = resumeContext()
  const source = ctx.createMediaStreamSource(stream)
  connectSource(source)
  return stream
}
