import '@fontsource/roboto'

import { useState } from 'react'

import { FatalErrorDialog } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { Button } from '@mui/material'

import { markCrashedSession } from '../crashedSession.ts'
import { createSessionLoaderFromUrl } from '../createSessionLoader.ts'
import factoryReset from '../factoryReset.ts'
import {
  permanentPluginSafeMode,
  readPermanentPlugins,
  reloadInSafeMode,
} from '../permanentPlugins.ts'
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
          // A permanent plugin loads on every visit, so one that crashes the
          // app leaves the user here with no way back to the menu that would
          // switch it off. Offered ahead of Reset Session, which throws away
          // the session instead — and only when there is a list to skip and it
          // isn't already being skipped.
          extraActions={
            !permanentPluginSafeMode() && readPermanentPlugins().length ? (
              <Button
                color="secondary"
                variant="contained"
                onClick={() => {
                  reloadInSafeMode()
                }}
              >
                Reload without permanent plugins
              </Button>
            ) : null
          }
        />
      )}
    >
      <Loader initialTimestamp={initialTimestamp} />
    </ErrorBoundary>
  )
}

export default LoaderWrapper
