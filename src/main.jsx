import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// StrictMode intentionally omitted: it double-invokes useEffect in dev, which
// disposes the WebGL renderer and tries to remount it on the same <canvas>.
// A canvas can only have one WebGL context per lifetime, so the second mount
// lands on a dead canvas and renders pure black.
createRoot(document.getElementById('root')).render(<App />)
