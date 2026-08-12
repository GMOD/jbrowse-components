import { StrictMode } from 'react'

import { setStackTraceLimit } from '@jbrowse/core/util/setStackTraceLimit'
import { setTypeChecking } from '@jbrowse/mobx-state-tree'
import { createRoot } from 'react-dom/client'

import InitialLoad from './InitialLoad.tsx'

// Dockview only mounts in workspaces mode (TiledViewsContainer, itself lazy),
// but a static import puts its 121KB stylesheet in the render-blocking <head>
// of every page load. Import it dynamically so it becomes an async CSS chunk.
// The import stays here rather than next to DockviewReact because packages/
// must not import css (breaks pure-ESM consumers).

setStackTraceLimit()

// MST skips run-time type-checking in production builds, where a config or
// session that doesn't match its model would otherwise fail later and further
// away. Keep it on: the validation error names the offending path.
//
// Said here rather than as a bundler-substituted `process.env.ENABLE_TYPE_CHECK`
// — the flag is a property of this app, not of the machine that builds it, and
// an explicit call carries to any bundler instead of needing each one to define
// a node global that does not exist in a browser.
setTypeChecking(true)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <InitialLoad />
  </StrictMode>,
)
