// first, so the config request and the worker start before main.js evaluates
// React DOM and the app shell
import './earlyStart.ts'

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
