import { StrictMode } from 'react'

import { createRoot } from 'react-dom/client'
import 'dockview-react/dist/styles/dockview.css'

import InitialLoad from './InitialLoad.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <InitialLoad />
  </StrictMode>,
)
