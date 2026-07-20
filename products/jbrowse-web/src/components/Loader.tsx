/**
 * Owns the SessionLoader state slot for jbrowse-web. The loader MST model
 * handles config + plugin loading; useLoaderLifecycle bridges its `ready`
 * signal to React (build the pluginManager via autorun) and the host-unmount
 * signal back to MST (dispose the rootModel). Plugin reloads swap the loader
 * instance via setLoader.
 */
import { useState } from 'react'

import { FatalErrorDialog } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'

import '@fontsource/roboto'

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
