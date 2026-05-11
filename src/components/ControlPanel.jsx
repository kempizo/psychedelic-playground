import useStore from '../store/useStore'

const CONTROLS = [
  { key: 'speed',      label: 'Speed',       min: 0.05, max: 1.5, step: 0.01 },
  { key: 'intensity',  label: 'Intensity',   min: 0,    max: 1.5, step: 0.01 },
  { key: 'colorShift', label: 'Color Shift', min: 0,    max: 1,   step: 0.01 },
  { key: 'chaos',      label: 'Chaos',       min: 0,    max: 1,   step: 0.01 },
  { key: 'trailDecay', label: 'Trail Decay', min: 0.70, max: 0.94, step: 0.01 },
  { key: 'cameraDistance', label: 'Camera Distance', min: -0.7, max: 0.9, step: 0.01 },
  { key: 'procIntensity', label: 'Texture Layer', min: 0, max: 1, step: 0.01 },
  { key: 'particleDensity', label: 'Particle Density', min: 0, max: 2, step: 0.01 },
]

const MODES = ['Fluid', 'Radial', 'Vortex', 'Collapse', 'Orbit']

export default function ControlPanel({ onReset, isHidden }) {
  const { speed, intensity, colorShift, chaos, mode, trailDecay, cameraDistance, procIntensity, particleDensity, setControl, resetControls } = useStore()

  const values = { speed, intensity, colorShift, chaos, trailDecay, cameraDistance, procIntensity, particleDensity }

  return (
    <div className={`fixed bottom-0 left-0 right-0 flex justify-center pb-6 px-4 pointer-events-none transition-opacity duration-500 ${isHidden ? 'opacity-0 pointer-events-none' : ''}`}>
      <div
        className="pointer-events-auto w-full max-w-xl rounded-2xl px-6 py-4 flex flex-col gap-3"
        style={{ background: 'rgba(5,5,5,0.75)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,200,170,0.15)' }}
      >
        <div className="flex justify-end gap-2 -mb-1">
          <button
            onClick={resetControls}
            className="text-xs font-mono px-3 py-1 rounded-full transition-all"
            style={{
              background: 'transparent',
              border: '1px solid rgba(200,60,255,0.25)',
              color: 'rgba(200,120,255,0.65)',
            }}
          >
            Reset to default
          </button>
          {onReset && (
            <button
              onClick={onReset}
              className="text-xs font-mono px-3 py-1 rounded-full transition-all"
              style={{
                background: 'transparent',
                border: '1px solid rgba(0,200,160,0.25)',
                color: 'rgba(0,220,180,0.6)',
              }}
            >
              Change source
            </button>
          )}
        </div>
        {CONTROLS.map(({ key, label, min, max, step }) => (
          <div key={key} className="flex items-center gap-4">
            <span className="text-xs font-mono w-20 shrink-0" style={{ color: 'rgba(0,220,180,0.75)' }}>
              {label}
            </span>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={values[key]}
              onChange={(e) => setControl(key, parseFloat(e.target.value))}
              className="flex-1 accent-teal-400 h-1 cursor-pointer"
            />
            <span className="text-xs font-mono w-10 text-right" style={{ color: 'rgba(0,220,180,0.5)' }}>
              {values[key].toFixed(2)}
            </span>
          </div>
        ))}

        {/* Mode pill group — 5 modes, wraps on narrow widths */}
        <div className="flex items-center gap-4 pt-1">
          <span className="text-xs font-mono w-20 shrink-0" style={{ color: 'rgba(0,220,180,0.75)' }}>
            Mode
          </span>
          <div className="flex flex-wrap gap-1.5">
            {MODES.map((label, i) => {
              const isPink = i >= 2
              const isActive = mode === i
              const activeColor = isPink ? 'rgba(200,60,255,0.9)' : 'rgba(0,220,180,1)'
              const activeBg    = isPink ? 'rgba(180,40,220,0.22)' : 'rgba(0,200,160,0.22)'
              const activeBorder= isPink ? 'rgba(180,40,220,0.65)' : 'rgba(0,200,160,0.65)'
              const idleColor   = isPink ? 'rgba(200,60,255,0.35)' : 'rgba(0,220,180,0.35)'
              const idleBorder  = isPink ? 'rgba(180,40,220,0.15)' : 'rgba(0,200,160,0.15)'
              return (
                <button
                  key={i}
                  onClick={() => setControl('mode', i)}
                  className="px-3 py-1 rounded-full text-xs font-mono transition-all"
                  style={{
                    background: isActive ? activeBg : 'transparent',
                    border: `1px solid ${isActive ? activeBorder : idleBorder}`,
                    color: isActive ? activeColor : idleColor,
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
