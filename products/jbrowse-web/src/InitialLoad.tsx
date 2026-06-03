import { Suspense, lazy } from 'react'

import { setGpuOverride } from '@jbrowse/core/gpu/gpuDevice'

import Loading from './components/Loading.tsx'
import { initAuthWindow } from './initAuthWindow.ts'

const Main = lazy(() => import('./components/Loader.tsx'))

initAuthWindow()
setGpuOverride(
  new URLSearchParams(window.location.search).get('renderer') ?? null,
)

const date = Date.now()
export default function InitialLoad() {
  return (
    <Suspense fallback={<Loading />}>
      <Main initialTimestamp={date} />
    </Suspense>
  )
}
