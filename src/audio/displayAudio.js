import { resumeContext, connectSource } from './analyser'

let activeStream = null
let endedHandler = null

export async function connectDisplayAudio(onEnded) {
  stopDisplayAudio()
  const md = navigator.mediaDevices
  if (!md || typeof md.getDisplayMedia !== 'function') {
    const err = new Error('Display capture is not supported in this browser.')
    err.code = 'UNSUPPORTED'
    throw err
  }
  const stream = await md.getDisplayMedia({
    audio: {
      systemAudio: 'include',
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    video: true,
  })
  const audioTracks = stream.getAudioTracks()
  if (audioTracks.length === 0) {
    stream.getTracks().forEach(t => t.stop())
    const err = new Error('NO_AUDIO_TRACK')
    err.code = 'NO_AUDIO_TRACK'
    throw err
  }
  stream.getVideoTracks().forEach(t => t.stop())
  activeStream = stream
  endedHandler = () => { stopDisplayAudio(); onEnded?.() }
  audioTracks[0].addEventListener('ended', endedHandler)
  const ctx = resumeContext()
  const source = ctx.createMediaStreamSource(stream)
  connectSource(source)
  return stream
}

export function stopDisplayAudio() {
  if (activeStream) {
    activeStream.getTracks().forEach(t => t.stop())
    activeStream = null
    endedHandler = null
  }
}
