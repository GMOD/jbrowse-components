import { StrictMode } from 'react'

import { setStackTraceLimit } from '@jbrowse/core/util/setStackTraceLimit'
import { createRoot } from 'react-dom/client'

import InitialLoad from './InitialLoad.tsx'
import { prewarmWorker } from './prewarmedWorker.ts'

setStackTraceLimit()
prewarmWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <InitialLoad />
  </StrictMode>,
)
