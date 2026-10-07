import { useEffect, useState } from 'react'

import { readQueryParams } from '@jbrowse/app-core'
import { setGpuOverride } from '@jbrowse/render-core/gpuDevice'
import { prewarmGraphics } from '@jbrowse/render-core/graphicsCapabilities'
import { observer } from 'mobx-react'

import Loading from './components/Loading.tsx'
import { loaderChunk } from './earlyStart.ts'
import { initAuthWindow } from './initAuthWindow.ts'

// One-time bootstrap, run at import time so it completes before the Loader
// chunk evaluates: wire up the auth popup channel, apply the renderer= GPU
// backend override (read via readQueryParams so it resolves from the hash on
// inline-session URLs, which move every param there) and start acquiring the
// GPU under it.
initAuthWindow()
setGpuOverride(readQueryParams(['renderer']).renderer ?? null)
prewarmGraphics()

// Captured once at load so re-renders keep a stable initialTimestamp (feeds the
// loader + load-time analytics).
const date = Date.now()

type LoaderChunk = Awaited<typeof loaderChunk>

// Plain state rather than React.lazy under Suspense: React holds a retry
// commit until 300ms after the last committed fallback, so a Suspense fallback
// here delayed the whole app's first commit by up to that long.
const InitialLoad = observer(function InitialLoad() {
  const [chunk, setChunk] = useState<PromiseSettledResult<LoaderChunk>>()
  useEffect(() => {
    loaderChunk.then(
      value => {
        setChunk({ status: 'fulfilled', value })
      },
      (reason: unknown) => {
        setChunk({ status: 'rejected', reason })
      },
    )
  }, [])
  if (!chunk) {
    return <Loading />
  } else if (chunk.status === 'rejected') {
    throw chunk.reason
  } else {
    const Main = chunk.value.default
    return <Main initialTimestamp={date} />
  }
})

export default InitialLoad
