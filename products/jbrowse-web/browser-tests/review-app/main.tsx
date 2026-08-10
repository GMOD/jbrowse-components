import './app.css'

import { createRoot } from 'react-dom/client'

import { App } from './App.tsx'

// Deliberately no <StrictMode>. Its double-invoked effects would start the
// /api/compare poll twice, and each round is a full re-read of a map the server
// fills in over ~25s of PNG decodes.
const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<App />)
}
