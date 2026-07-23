import '@fontsource/roboto'

import { useState } from 'react'

import { FatalErrorDialog } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'

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
