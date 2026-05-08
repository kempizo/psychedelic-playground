import { useState, useEffect, useCallback } from 'react'
import VisualCanvas from './components/VisualCanvas'
import LandingScreen from './components/LandingScreen'
import ControlPanel from './components/ControlPanel'
import ShareButton from './components/ShareButton'
import { useURLState } from './hooks/useURLState'
import { stopMic } from './audio/mic'
import { stopFile } from './audio/fileAudio'
import useStore from './store/useStore'

export default function App() {
  const [started, setStarted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isUIHidden, setIsUIHidden] = useState(false)
  useURLState()

  const handleReset = () => {
    stopMic()
    stopFile()
    useStore.getState().setIsPlaying(false)
    useStore.getState().setAudioSource(null)
    setStarted(false)
  }

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  useEffect(() => {
    if (!started) return
    const onKey = (e) => {
      if (e.key === 'h' || e.key === 'H') setIsUIHidden(v => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [started])

  const uiOpacity = isUIHidden ? 0 : 1

  return (
    <div className="w-full h-full relative">
      <VisualCanvas />

      {!started && <LandingScreen onStarted={() => setStarted(true)} />}

      {started && (
        <>
          <ControlPanel onReset={handleReset} isHidden={isUIHidden} />
          <ShareButton isHidden={isUIHidden} />

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            className="fixed top-5 left-5 w-8 h-8 rounded flex items-center justify-center text-xs font-mono transition-all"
            style={{
              background: 'rgba(5,5,5,0.5)',
              border: '1px solid rgba(0,200,160,0.2)',
              color: 'rgba(0,220,180,0.7)',
              opacity: isUIHidden ? 0.15 : 0.7,
              backdropFilter: 'blur(8px)',
            }}
          >
            {isFullscreen ? '⊡' : '⊞'}
          </button>

          {/* H-key hint when UI is hidden */}
          {isUIHidden && (
            <div
              className="fixed bottom-4 left-0 right-0 flex justify-center pointer-events-none"
              style={{ opacity: uiOpacity === 0 ? 0.18 : 0 }}
            >
              <span className="text-xs font-mono" style={{ color: 'rgba(0,220,180,0.5)' }}>H to show UI</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
