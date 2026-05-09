import { useRef, forwardRef, useImperativeHandle } from 'react'
import { useThreeScene } from '../hooks/useThreeScene'
import { useAudioAnalyser } from '../hooks/useAudioAnalyser'

const VisualCanvas = forwardRef(function VisualCanvas(_, ref) {
  const canvasRef = useRef(null)
  useThreeScene(canvasRef)
  useAudioAnalyser()

  useImperativeHandle(ref, () => canvasRef.current)

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ display: 'block' }}
    />
  )
})

export default VisualCanvas
