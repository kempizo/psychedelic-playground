import { useRef, useState } from 'react'
import { createAnalyser } from '../audio/analyser'
import { connectMic } from '../audio/mic'
import { connectFile } from '../audio/fileAudio'
import { connectDisplayAudio } from '../audio/displayAudio'
import useStore from '../store/useStore'

export default function AudioInput({ onStarted, onSourceEnded }) {
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef(null)

  async function start(fn, source) {
    setError(null)
    setLoading(true)
    try {
      createAnalyser()
      await fn()
      useStore.getState().setIsPlaying(true)
      useStore.getState().setAudioSource(source)
      onStarted()
    } catch (e) {
      if (e?.code === 'NO_AUDIO_TRACK') {
        setError("No audio track was shared. Try selecting a tab/window and enable 'Share audio' in the picker, or use microphone/file input.")
      } else if (e?.code === 'UNSUPPORTED') {
        setError('System/tab audio capture is not supported in this browser. Use microphone or file input.')
      } else if (e?.name === 'NotAllowedError' || e?.name === 'AbortError') {
        setError('Permission denied or share cancelled.')
      } else {
        setError(e?.message || 'Something went wrong')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleMic = () => start(connectMic, 'mic')

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ok = file.type.startsWith('audio/')
    if (!ok) { setError('Please upload an audio file (MP3, WAV, etc.)'); return }
    start(() => connectFile(file), 'file')
  }

  const handleDisplay = () => start(() => connectDisplayAudio(onSourceEnded), 'display')

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-4 flex-wrap justify-center">
        <button
          onClick={handleMic}
          disabled={loading}
          className="px-6 py-3 rounded-full text-sm font-mono transition-all disabled:opacity-50"
          style={{
            background: 'rgba(0,200,160,0.12)',
            border: '1px solid rgba(0,200,160,0.4)',
            color: 'rgba(0,220,180,0.9)',
          }}
        >
          Use Microphone
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          className="px-6 py-3 rounded-full text-sm font-mono transition-all disabled:opacity-50"
          style={{
            background: 'rgba(80,200,60,0.08)',
            border: '1px solid rgba(80,200,60,0.3)',
            color: 'rgba(100,220,80,0.85)',
          }}
        >
          Upload Audio
        </button>

        <button
          onClick={handleDisplay}
          disabled={loading}
          className="px-6 py-3 rounded-full text-sm font-mono transition-all disabled:opacity-50"
          style={{
            background: 'rgba(140,120,220,0.10)',
            border: '1px solid rgba(140,120,220,0.4)',
            color: 'rgba(180,160,240,0.9)',
          }}
        >
          System / Tab Audio
        </button>

        <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={handleFile} />
      </div>

      <p
        className="text-[10px] font-mono max-w-md text-center"
        style={{ color: 'rgba(140,160,200,0.45)', lineHeight: 1.6 }}
      >
        System audio capture is browser/OS dependent. Choose a tab/window and enable “Share audio”
        in the picker. On macOS this typically works for individual tabs.
      </p>

      {error && (
        <p className="text-xs font-mono max-w-md text-center" style={{ color: 'rgba(255,80,80,0.8)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
