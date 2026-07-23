import 'dockview-react/dist/styles/dockview.css'

import { StrictMode } from 'react'

import { setStackTraceLimit } from '@jbrowse/core/util/setStackTraceLimit'
import { createRoot } from 'react-dom/client'

import InitialLoad from './InitialLoad.tsx'

setStackTraceLimit()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <InitialLoad />
  </StrictMode>,
)
