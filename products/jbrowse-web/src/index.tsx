import { StrictMode } from 'react'

import { createRoot } from 'react-dom/client'

import InitialLoad from './InitialLoad.tsx'

import 'dockview-react/dist/styles/dockview.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <InitialLoad />
  </StrictMode>,
)
