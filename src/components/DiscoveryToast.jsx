import { useEffect, useRef, useState } from 'react'
import useStore from '../store/useStore'

const MESSAGES = {
  circle:      { title: 'Circle unlocked',    body: 'Drawing circles feeds energy into the field.' },
  figure8:     { title: 'Figure-8 unlocked',  body: 'The infinity loop bends the color spectrum.' },
  rapidClick:  { title: 'Rapid tap unlocked', body: 'Fast clicks ignite a pulse storm.' },
  idle:        { title: 'Stillness unlocked', body: 'Silence lets the field breathe on its own.' },
}

export default function DiscoveryToast() {
  const discoveries = useStore(s => s.discoveries)
  const prevLen = useRef(0)
  const [queue, setQueue] = useState([])
  const [visible, setVisible] = useState(false)
  const [current, setCurrent] = useState(null)
  const hideTimer = useRef(null)

  // Enqueue any newly added discovery keys (only known keys)
  useEffect(() => {
    if (discoveries.length <= prevLen.current) {
      prevLen.current = discoveries.length
      return
    }
    const newKeys = discoveries.slice(prevLen.current).filter(k => k in MESSAGES)
    prevLen.current = discoveries.length
    if (newKeys.length > 0) setQueue(q => [...q, ...newKeys])
  }, [discoveries])

  // Dequeue and display one at a time — state updates deferred to avoid
  // the react-hooks/set-state-in-effect lint rule (synchronous setState in effect)
  useEffect(() => {
    if (visible || queue.length === 0) return
    const [key, ...rest] = queue
    const tid = setTimeout(() => {
      setCurrent(MESSAGES[key])
      setQueue(rest)
      setVisible(true)
      clearTimeout(hideTimer.current)
      hideTimer.current = setTimeout(() => setVisible(false), 4000)
    }, 0)
    return () => clearTimeout(tid)
  }, [queue, visible])

  useEffect(() => () => clearTimeout(hideTimer.current), [])

  if (!current) return null

  return (
    <div
      className="fixed bottom-20 left-0 right-0 flex justify-center pointer-events-none"
      style={{ zIndex: 50 }}
    >
      <div
        style={{
          background: 'rgba(5,5,5,0.75)',
          border: '1px solid rgba(0,200,160,0.35)',
          borderRadius: 10,
          backdropFilter: 'blur(12px)',
          padding: '10px 18px',
          maxWidth: 320,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(12px)',
          transition: 'opacity 0.35s ease, transform 0.35s ease',
        }}
      >
        <p
          className="text-xs font-mono font-semibold"
          style={{ color: 'rgba(0,220,180,0.9)', marginBottom: 3 }}
        >
          {current.title}
        </p>
        <p
          className="text-xs font-mono"
          style={{ color: 'rgba(180,255,240,0.6)', lineHeight: 1.5 }}
        >
          {current.body}
        </p>
      </div>
    </div>
  )
}
