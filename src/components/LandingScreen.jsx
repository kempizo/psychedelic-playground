import { useState } from 'react'
import AudioInput from './AudioInput'

export default function LandingScreen({ onStarted }) {
  const [fading, setFading] = useState(false)

  const handleStarted = () => {
    setFading(true)
    setTimeout(onStarted, 600)
  }

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center z-10 transition-opacity duration-600"
      style={{
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? 'none' : 'auto',
        background: 'rgba(5,5,5,0.55)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div className="flex flex-col items-center gap-8 px-6 text-center">
        <div>
          <h1
            className="text-5xl font-mono font-bold tracking-widest mb-3"
            style={{ color: 'rgba(0,220,180,0.95)', textShadow: '0 0 40px rgba(0,200,160,0.4)' }}
          >
            PSYCHEDELIC
          </h1>
          <p
            className="text-sm font-mono tracking-widest uppercase"
            style={{ color: 'rgba(0,200,160,0.4)', letterSpacing: '0.3em' }}
          >
            Organic Consciousness Engine
          </p>
        </div>

        <AudioInput onStarted={handleStarted} />

        <p
          className="text-xs font-mono max-w-xs"
          style={{ color: 'rgba(0,200,160,0.25)', lineHeight: 1.8 }}
        >
          Feed it sound. Watch it breathe.
        </p>
      </div>
    </div>
  )
}
