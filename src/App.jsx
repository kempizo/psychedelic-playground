import { useState } from 'react'
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
  useURLState()

  const handleReset = () => {
    stopMic()
    stopFile()
    useStore.getState().setIsPlaying(false)
    useStore.getState().setAudioSource(null)
    setStarted(false)
  }

  return (
    <div className="w-full h-full relative">
      {/* Canvas always mounted — animates idle on landing too */}
      <VisualCanvas />

      {!started && <LandingScreen onStarted={() => setStarted(true)} />}

      {started && (
        <>
          <ControlPanel onReset={handleReset} />
          <ShareButton />
        </>
      )}
    </div>
  )
}
