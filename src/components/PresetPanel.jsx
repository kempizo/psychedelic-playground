import { useState } from 'react'
import useStore from '../store/useStore'
import { serializeWithPreset } from '../utils/shareUtils'

export default function PresetPanel({ isHidden }) {
  const [copied, setCopied] = useState(false)
  const { presets, activePresetId, savePreset, loadPreset, deletePreset, mutateCurrent } = useStore()

  const handleSharePreset = () => {
    const state = useStore.getState()
    const active = state.presets.find(p => p.id === state.activePresetId)
    if (!active) return
    navigator.clipboard.writeText(serializeWithPreset(state, active)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const activePreset = presets.find(p => p.id === activePresetId)

  return (
    <div
      className="fixed bottom-6 left-5 z-20 transition-all duration-300"
      style={{
        opacity: isHidden ? 0 : 1,
        pointerEvents: isHidden ? 'none' : 'auto',
      }}
    >
      <div
        className="flex flex-col gap-2 p-3 rounded-2xl"
        style={{
          background: 'rgba(5,5,5,0.75)',
          border: '1px solid rgba(0,120,100,0.3)',
          backdropFilter: 'blur(12px)',
          minWidth: '130px',
          maxWidth: '160px',
        }}
      >
        <div className="flex gap-1.5">
          <button
            onClick={savePreset}
            className="flex-1 text-xs font-mono py-1 rounded-lg"
            style={{
              background: 'rgba(0,200,160,0.12)',
              border: '1px solid rgba(0,200,160,0.3)',
              color: 'rgba(0,220,180,0.9)',
            }}
          >
            Save
          </button>
          <button
            onClick={mutateCurrent}
            className="flex-1 text-xs font-mono py-1 rounded-lg"
            style={{
              background: 'rgba(80,20,140,0.2)',
              border: '1px solid rgba(100,50,180,0.35)',
              color: 'rgba(160,100,255,0.9)',
            }}
          >
            Mutate
          </button>
        </div>

        {presets.length > 0 && (
          <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: '180px' }}>
            {presets.map((preset) => (
              <div key={preset.id} className="flex items-center gap-1">
                <button
                  onClick={() => loadPreset(preset.id)}
                  className="flex-1 text-left text-xs font-mono px-2 py-1 rounded-lg truncate"
                  style={{
                    background: preset.id === activePresetId
                      ? 'rgba(0,200,160,0.18)'
                      : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${preset.id === activePresetId ? 'rgba(0,200,160,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    color: preset.id === activePresetId
                      ? 'rgba(0,220,180,0.95)'
                      : 'rgba(200,200,200,0.6)',
                  }}
                >
                  {preset.name}
                </button>
                <button
                  onClick={() => deletePreset(preset.id)}
                  className="text-xs w-5 h-5 flex items-center justify-center rounded flex-shrink-0"
                  style={{ color: 'rgba(200,200,200,0.4)' }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {activePreset && (
          <button
            onClick={handleSharePreset}
            className="text-xs font-mono py-1 rounded-lg"
            style={{
              background: copied ? 'rgba(0,200,160,0.2)' : 'rgba(0,200,160,0.07)',
              border: '1px solid rgba(0,200,160,0.25)',
              color: copied ? 'rgba(0,220,180,1.0)' : 'rgba(0,200,160,0.6)',
            }}
          >
            {copied ? 'Copied!' : 'Share Preset'}
          </button>
        )}
      </div>
    </div>
  )
}
