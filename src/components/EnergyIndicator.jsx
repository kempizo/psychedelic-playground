import useStoreHook from '../store/useStore'

// Diegetic edge glow — opacity driven by energy, hue follows palette family.
// State glyph appears only during peak/afterglow.
export default function EnergyIndicator({ isHidden, isRecording }) {
  const energy = useStoreHook(s => s.energy)
  const behavioralState = useStoreHook(s => s.behavioralState)

  if (isHidden || isRecording) return null

  const opacity = energy
  // Teal for calm/build, brighter teal-green at peak, afterglow fades violet
  const hue = behavioralState === 'peak' ? '0, 220, 150'
            : behavioralState === 'afterglow' ? '80, 160, 200'
            : '0, 200, 170'

  const glyphMap = { peak: '◆', afterglow: '◇' }
  const glyph = glyphMap[behavioralState] ?? null

  return (
    <>
      {/* Edge glow: inset box-shadow so it hugs the canvas border */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          boxShadow: `inset 0 0 60px 8px rgba(${hue}, ${opacity * 0.7})`,
          transition: 'box-shadow 0.15s ease-out',
          zIndex: 10,
        }}
      />
      {/* State glyph — bottom-right corner, only during peak/afterglow */}
      {glyph && (
        <div
          className="fixed bottom-6 right-6 pointer-events-none font-mono text-xs"
          style={{
            color: `rgba(${hue}, ${Math.min(opacity * 1.5, 0.7)})`,
            transition: 'opacity 0.4s ease-out',
            zIndex: 11,
          }}
        >
          {glyph}
        </div>
      )}
    </>
  )
}
