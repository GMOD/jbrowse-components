import { StrictMode } from 'react'

import { setStackTraceLimit } from '@jbrowse/core/util/setStackTraceLimit'
import { createRoot } from 'react-dom/client'

import InitialLoad from './InitialLoad.tsx'
import { prefetchConfig } from './prefetchConfig.ts'
import { prewarmWorker } from './prewarmedWorker.ts'

setStackTraceLimit()
prefetchConfig()
prewarmWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <InitialLoad />
  </StrictMode>,
)
