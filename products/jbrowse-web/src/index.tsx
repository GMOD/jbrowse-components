import { StrictMode } from 'react'

import { createRoot } from 'react-dom/client'

import InitialLoad from './InitialLoad.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <InitialLoad />
  </StrictMode>,
)
