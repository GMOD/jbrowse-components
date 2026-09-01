import './app.css'

import { useState } from 'react'

import { createRoot } from 'react-dom/client'

import { App } from './App.tsx'
import { Videos } from './Videos.tsx'

// Two reviews, one server, one tab. Figures and clips share the write protocol
// and nothing else — a clip has no baseline, no store and no live session — so
// the switch is here rather than inside App, which stays exactly the figure
// tool it was. Mounting one at a time also keeps /api/specs, the expensive
// scan, off the path when the reviewer only came to watch a take.
function Review() {
  const [tab, setTab] = useState<'figures' | 'videos'>(() =>
    location.hash === '#videos' ? 'videos' : 'figures',
  )
  const go = (next: 'figures' | 'videos') => {
    location.hash = next === 'videos' ? 'videos' : ''
    setTab(next)
  }
  return (
    <>
      <nav className="toptabs">
        <button
          type="button"
          className={tab === 'figures' ? 'pressed' : ''}
          onClick={() => {
            go('figures')
          }}
        >
          Figures
        </button>
        <button
          type="button"
          className={tab === 'videos' ? 'pressed' : ''}
          onClick={() => {
            go('videos')
          }}
        >
          Videos
        </button>
      </nav>
      {tab === 'videos' ? <Videos /> : <App />}
    </>
  )
}

// Deliberately no <StrictMode>. Its double-invoked effects would issue
// /api/specs twice, and that endpoint rescans the working tree and hashes the
// ~68 MB of figures on disk — the most expensive thing this server does, and the
// one the load path is already carefully arranged not to pay twice.
const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<Review />)
}
