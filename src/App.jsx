import { useState } from 'react'
import VisualCanvas from './components/VisualCanvas'
import LandingScreen from './components/LandingScreen'
import ControlPanel from './components/ControlPanel'
import ShareButton from './components/ShareButton'
import { useURLState } from './hooks/useURLState'

export default function App() {
  const [started, setStarted] = useState(false)
  useURLState()

  return (
    <div className="w-full h-full relative">
      {/* Canvas always mounted — animates idle on landing too */}
      <VisualCanvas />

      {!started && <LandingScreen onStarted={() => setStarted(true)} />}

      {started && (
        <>
          <ControlPanel />
          <ShareButton />
        </>
      )}
    </div>
  )
}
