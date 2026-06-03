import { Suspense, lazy } from 'react'

import { setGpuOverride } from '@jbrowse/core/gpu/gpuDevice'

import Loading from './components/Loading.tsx'
import { initAuthWindow } from './initAuthWindow.ts'

const Main = lazy(() => import('./components/Loader.tsx'))

// One-time bootstrap, run at import time so it completes before the lazy Loader
// chunk (and the rest of the app) loads: wire up the auth popup channel and
// apply the ?renderer= GPU backend override.
initAuthWindow()
setGpuOverride(
  new URLSearchParams(window.location.search).get('renderer') ?? null,
)

// Captured once at load so re-renders keep a stable initialTimestamp (feeds the
// loader + load-time analytics).
const date = Date.now()
export default function InitialLoad() {
  return (
    <Suspense fallback={<Loading />}>
      <Main initialTimestamp={date} />
    </Suspense>
  )
}
