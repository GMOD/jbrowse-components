/**
 * pluginManager/rootModel lifecycle: the SessionLoader MST model owns build
 * and dispose. React just kicks off the build when the loader becomes ready
 * and disposes on unmount. reloadPluginManager swaps the loader instance; the
 * key on Renderer changes, React remounts, and the new loader builds cleanly.
 * HMR reuses the same loader — disposePluginManager writes the live session
 * back to the loader so the next build can restore it.
 */
import { Suspense, lazy, useEffect, useState } from 'react'

import { setGpuOverride } from '@jbrowse/core/gpu/gpuDevice'
import { FatalErrorDialog } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { observer } from 'mobx-react'

import '@fontsource/roboto'

import JBrowse from './JBrowse.tsx'
import Loading from './Loading.tsx'
import SessionLoader from '../SessionLoader.ts'
import factoryReset from '../factoryReset.ts'
import { deleteQueryParams, readQueryParams } from '../useQueryParam.ts'

import type { SessionLoaderModel } from '../SessionLoader.ts'

setGpuOverride(
  new URLSearchParams(window.location.search).get('renderer') ?? null,
)

const isJest = typeof jest !== 'undefined'

const SessionTriaged = lazy(() => import('./SessionTriaged.tsx'))
const LoaderErrorBanner = lazy(() => import('./LoaderErrorBanner.tsx'))

const paramsToDelete = [
  'loc',
  'tracks',
  'assembly',
  'password',
  'sessionTracks',
  'hubURL',
  'tracklist',
  'nav',
  'highlight',
  'sessionName',
] as const

export function Loader({
  initialTimestamp: initialTimestampProp,
}: {
  initialTimestamp?: number
}) {
  const [loader, setLoader] = useState(() => {
    const {
      config,
      session,
      adminKey,
      password,
      loc,
      assembly,
      tracks,
      sessionTracks,
      tracklist,
      highlight,
      nav,
      hubURL,
      sessionName,
    } = readQueryParams([
      'config',
      'session',
      'adminKey',
      'password',
      'loc',
      'assembly',
      'tracks',
      'sessionTracks',
      'tracklist',
      'highlight',
      'nav',
      'hubURL',
      'sessionName',
    ])
    deleteQueryParams(paramsToDelete)
    return SessionLoader.create({
      configPath: config,
      sessionQuery: session,
      password,
      adminKey,
      loc,
      assembly,
      tracks,
      sessionTracks,
      tracklist: tracklist === 'true',
      highlight,
      nav: nav !== 'false',
      hubURL: hubURL?.split(','),
      sessionName,
      initialTimestamp: initialTimestampProp ?? Date.now(),
    })
  })

  const reloadPluginManager = (
    configSnapshot: Record<string, unknown>,
    sessionSnapshot: Record<string, unknown>,
  ) => {
    setLoader(prev =>
      SessionLoader.create({
        ...getSnapshot(prev),
        initialTimestamp: Date.now(),
        configSnapshot,
        sessionSnapshot,
      }),
    )
  }

  return (
    <Renderer
      key={loader.initialTimestamp}
      loader={loader}
      reloadPluginManager={reloadPluginManager}
    />
  )
}

const Renderer = observer(function Renderer({
  loader,
  reloadPluginManager,
}: {
  loader: SessionLoaderModel
  reloadPluginManager: (
    configSnapshot: Record<string, unknown>,
    sessionSnapshot: Record<string, unknown>,
  ) => void
}) {
  const { configError, pluginManager, pluginManagerError, ready, sessionTriaged } =
    loader

  useEffect(() => {
    if (ready) {
      loader.buildPluginManager(reloadPluginManager)
    }
    return () => {
      if (!isJest) {
        loader.disposePluginManager()
      }
    }
  }, [ready, loader, reloadPluginManager])

  const err = configError || pluginManagerError
  if (err) {
    return (
      <Suspense fallback={null}>
        <LoaderErrorBanner error={err} />
      </Suspense>
    )
  } else if (sessionTriaged) {
    return (
      <Suspense fallback={null}>
        <SessionTriaged loader={loader} sessionTriaged={sessionTriaged} />
      </Suspense>
    )
  } else if (pluginManager) {
    return <JBrowse pluginManager={pluginManager} />
  } else {
    return <Loading />
  }
})

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
