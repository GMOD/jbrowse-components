import './app.css'

import { createRoot } from 'react-dom/client'

import { App } from './App.tsx'

// Deliberately no <StrictMode>. Its double-invoked effects would issue
// /api/specs twice, and that endpoint rescans the working tree and hashes the
// ~68 MB of figures on disk — the most expensive thing this server does, and the
// one the load path is already carefully arranged not to pay twice.
const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<App />)
}
