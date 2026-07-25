import { StrictMode } from 'react'

import { setStackTraceLimit } from '@jbrowse/core/util/setStackTraceLimit'
import { createRoot } from 'react-dom/client'

import InitialLoad from './InitialLoad.tsx'

// Dockview only mounts in workspaces mode (TiledViewsContainer, itself lazy),
// but a static import puts its 121KB stylesheet in the render-blocking <head>
// of every page load. Import it dynamically so it becomes an async CSS chunk.
// The import stays here rather than next to DockviewReact because packages/
// must not import css (breaks pure-ESM consumers).
void import('dockview-react/dist/styles/dockview.css')

setStackTraceLimit()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <InitialLoad />
  </StrictMode>,
)
