import { useState } from 'react'
import useStore from '../store/useStore'
import { serialize } from '../utils/shareUtils'

export default function ShareButton({ isHidden }) {
  const [copied, setCopied] = useState(false)
  const state = useStore()

  const handleShare = async () => {
    const url = serialize(state)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this URL:', url)
    }
  }

  return (
    <button
      onClick={handleShare}
      className={`fixed top-5 right-16 px-4 py-2 rounded-full text-xs font-mono transition-all ${isHidden ? 'opacity-0 pointer-events-none' : ''}`}
      style={{
        background: copied ? 'rgba(0,200,160,0.3)' : 'rgba(5,5,5,0.7)',
        border: `1px solid ${copied ? 'rgba(0,200,160,0.8)' : 'rgba(0,200,160,0.2)'}`,
        color: copied ? 'rgba(0,240,200,1)' : 'rgba(0,200,160,0.6)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {copied ? 'Copied!' : 'Share'}
    </button>
  )
}
