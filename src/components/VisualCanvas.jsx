import { useRef } from 'react'
import { useThreeScene } from '../hooks/useThreeScene'
import { useAudioAnalyser } from '../hooks/useAudioAnalyser'

export default function VisualCanvas() {
  const canvasRef = useRef(null)
  useThreeScene(canvasRef)
  useAudioAnalyser()

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ display: 'block' }}
    />
  )
}
