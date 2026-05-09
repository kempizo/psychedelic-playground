import { useEffect, useRef, useState } from 'react'
import useStore from '../store/useStore'
import { startRecording } from '../utils/recordUtils'

const SIZE = 36
const R = 14
const CIRCUMFERENCE = 2 * Math.PI * R

export default function RecordButton({ canvasRef, isHidden }) {
  const isRecording = useStore(s => s.isRecording)
  const setIsRecording = useStore(s => s.setIsRecording)
  const [progress, setProgress] = useState(0)
  const [pulse, setPulse] = useState(false)
  const stopRef = useRef(null)

  // 1Hz pulse while recording
  useEffect(() => {
    if (!isRecording) return
    const iv = setInterval(() => setPulse(p => !p), 500)
    return () => { clearInterval(iv); setPulse(false) }
  }, [isRecording])

  const handleClick = (e) => {
    if (isRecording) return

    const durationMs = e.shiftKey ? 16000 : 8000
    const canvas = canvasRef?.current
    if (!canvas) return

    setIsRecording(true)
    setProgress(0)

    stopRef.current = startRecording(
      canvas,
      durationMs,
      (p) => setProgress(p),
      () => { setIsRecording(false); setProgress(0) },
    )
  }

  const dashOffset = CIRCUMFERENCE * (1 - progress)

  return (
    <button
      onClick={handleClick}
      title={isRecording ? `Recording… ${Math.round(progress * 100)}%` : 'Record (Shift+click = 16s)'}
      disabled={isRecording}
      className="fixed top-5 right-5 flex items-center justify-center transition-all"
      style={{
        width: SIZE,
        height: SIZE,
        background: 'rgba(5,5,5,0.5)',
        border: '1px solid rgba(0,200,160,0.2)',
        borderRadius: '50%',
        backdropFilter: 'blur(8px)',
        cursor: isRecording ? 'default' : 'pointer',
        opacity: isHidden ? 0.15 : 0.8,
      }}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ position: 'absolute', top: 0, left: 0 }}>
        {/* Progress ring — visible only while recording */}
        {isRecording && (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="rgba(220,60,60,0.85)"
            strokeWidth="2"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            style={{ transition: 'stroke-dashoffset 0.1s linear' }}
          />
        )}
      </svg>

      {/* Center dot */}
      <div
        style={{
          width: isRecording ? 10 : 8,
          height: isRecording ? 10 : 8,
          borderRadius: '50%',
          background: isRecording
            ? pulse ? 'rgba(255,60,60,1)' : 'rgba(200,40,40,0.7)'
            : 'rgba(0,220,180,0.7)',
          transition: 'background 0.2s, width 0.2s, height 0.2s',
          zIndex: 1,
        }}
      />
    </button>
  )
}
