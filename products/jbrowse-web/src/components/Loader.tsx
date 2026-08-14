import '@fontsource/roboto'

import { useState } from 'react'

import { FatalErrorDialog } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'

import { markCrashedSession } from '../crashedSession.ts'
import { createSessionLoaderFromUrl } from '../createSessionLoader.ts'
import factoryReset from '../factoryReset.ts'
import Renderer from './Renderer.tsx'
import { useLoaderLifecycle } from './useLoaderLifecycle.ts'

export function Loader({ initialTimestamp }: { initialTimestamp?: number }) {
  const [loader, setLoader] = useState(() =>
    createSessionLoaderFromUrl(initialTimestamp ?? Date.now()),
  )
  useLoaderLifecycle(loader, setLoader)
  return <Renderer loader={loader} />
}

function LoaderWrapper({ initialTimestamp }: { initialTimestamp: number }) {
  return (
    <ErrorBoundary
      // before the dialog renders, because the dialog's own Refresh is what
      // this marker exists to survive: without it, a reload restores the
      // snapshot the autosave wrote at most 400ms before the crash and crashes
      // again, leaving Reset Session (which discards the session) as the only
      // way out. Marked here rather than in the fallback so it does not depend
      // on one more render going right on the way down.
      onError={markCrashedSession}
      FallbackComponent={props => (
        <FatalErrorDialog
          {...props}
          resetButtonText="Reset Session"
          onFactoryReset={factoryReset}
        />
      )}
    >
      <Loader initialTimestamp={initialTimestamp} />
    </ErrorBoundary>
  )
}

export default LoaderWrapper
