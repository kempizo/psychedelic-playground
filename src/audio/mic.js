import { resumeContext, connectSource } from './analyser'

let activeStream = null

export async function connectMic() {
  stopMic()
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
  activeStream = stream
  const ctx = resumeContext()
  const source = ctx.createMediaStreamSource(stream)
  connectSource(source)
  return stream
}

export function stopMic() {
  if (activeStream) {
    activeStream.getTracks().forEach((t) => t.stop())
    activeStream = null
  }
}
