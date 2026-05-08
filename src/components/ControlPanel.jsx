import useStore from '../store/useStore'

const CONTROLS = [
  { key: 'speed',      label: 'Speed',       min: 0.05, max: 1.5, step: 0.01 },
  { key: 'intensity',  label: 'Intensity',   min: 0,    max: 1.5, step: 0.01 },
  { key: 'colorShift', label: 'Color Shift', min: 0,    max: 1,   step: 0.01 },
  { key: 'chaos',      label: 'Chaos',       min: 0,    max: 1,   step: 0.01 },
]

export default function ControlPanel({ onReset }) {
  const { speed, intensity, colorShift, chaos, mode, setControl } = useStore()

  const values = { speed, intensity, colorShift, chaos }

  return (
    <div className="fixed bottom-0 left-0 right-0 flex justify-center pb-6 px-4 pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-xl rounded-2xl px-6 py-4 flex flex-col gap-3"
        style={{ background: 'rgba(5,5,5,0.75)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,200,170,0.15)' }}
      >
        {onReset && (
          <div className="flex justify-end -mb-1">
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
          </div>
        )}
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

        {/* Mode toggle */}
        <div className="flex items-center gap-4 pt-1">
          <span className="text-xs font-mono w-20 shrink-0" style={{ color: 'rgba(0,220,180,0.75)' }}>
            Mode
          </span>
          <div className="flex gap-2">
            {['Fluid', 'Radial'].map((label, i) => (
              <button
                key={i}
                onClick={() => setControl('mode', i)}
                className="px-3 py-1 rounded-full text-xs font-mono transition-all"
                style={{
                  background: mode === i ? 'rgba(0,200,160,0.25)' : 'transparent',
                  border: `1px solid ${mode === i ? 'rgba(0,200,160,0.6)' : 'rgba(0,200,160,0.15)'}`,
                  color: mode === i ? 'rgba(0,220,180,1)' : 'rgba(0,220,180,0.4)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
