import { useRef, useState } from 'react'
import { createAnalyser } from '../audio/analyser'
import { connectMic } from '../audio/mic'
import { connectFile } from '../audio/fileAudio'
import useStore from '../store/useStore'

export default function AudioInput({ onStarted }) {
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef(null)

  async function start(fn) {
    setError(null)
    setLoading(true)
    try {
      createAnalyser()
      await fn()
      useStore.getState().setIsPlaying(true)
      onStarted()
    } catch (e) {
      setError(e.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleMic = () => start(connectMic)

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ok = file.type.startsWith('audio/')
    if (!ok) { setError('Please upload an audio file (MP3, WAV, etc.)'); return }
    start(() => connectFile(file))
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-4">
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
        <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={handleFile} />
      </div>

      {error && (
        <p className="text-xs font-mono" style={{ color: 'rgba(255,80,80,0.8)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
