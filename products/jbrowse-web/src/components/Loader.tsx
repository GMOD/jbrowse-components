/**
 * The pluginManager/rootModel can be destroyed and recreated without a full
 * page reload. Plugin install resets the loader with updated config and session
 * snapshots via resetForPluginReload, triggering plugin reload. HMR saves the
 * current session to the loader in useEffect cleanup before destroying.
 */
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'

import { FatalErrorDialog } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { destroy, getSnapshot } from '@jbrowse/mobx-state-tree'
import { observer } from 'mobx-react'

import '@fontsource/roboto'

import JBrowse from './JBrowse.tsx'
import Loading from './Loading.tsx'
import SessionLoader from '../SessionLoader.ts'
import { createPluginManager } from '../createPluginManager.ts'
import factoryReset from '../factoryReset.ts'
import { deleteQueryParams, readQueryParams } from '../useQueryParam.ts'

import type { SessionLoaderModel } from '../SessionLoader.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

const SessionTriaged = lazy(() => import('./SessionTriaged.tsx'))
const StartScreenErrorMessage = lazy(
  () => import('./StartScreenErrorMessage.tsx'),
)

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
] as const

export function Loader({
  initialTimestamp: initialTimestampProp,
}: {
  initialTimestamp?: number
}) {
  const [initialTimestamp] = useState(() => initialTimestampProp ?? Date.now())

  const [loader] = useState(() => {
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
    ])

    return SessionLoader.create({
      configPath: config,
      sessionQuery: session,
      password,
      adminKey,
      loc,
      assembly,
      tracks,
      sessionTracks,
      tracklist: JSON.parse(tracklist || 'false'),
      highlight,
      nav: JSON.parse(nav || 'true'),
      hubURL: hubURL?.split(','),
      initialTimestamp,
    })
  })

  useEffect(() => {
    deleteQueryParams([...paramsToDelete])
  }, [])

  return <Renderer loader={loader} />
}

const Renderer = observer(function Renderer({
  loader,
}: {
  loader: SessionLoaderModel
}) {
  const pluginManager = useRef<PluginManager | undefined>(undefined)
  const [pluginManagerCreated, setPluginManagerCreated] = useState(false)

  // Called by rootModel when plugins are installed/removed. Resets the loader
  // with updated snapshots, triggering plugin reload and pluginManager recreation.
  const reloadPluginManager = useCallback(
    (
      configSnapshot: Record<string, unknown>,
      sessionSnapshot: Record<string, unknown>,
    ) => {
      loader.resetForPluginReload(configSnapshot, sessionSnapshot)
      setPluginManagerCreated(false)
    },
    [loader],
  )
  const { configError, ready, sessionTriaged } = loader
  const [error, setError] = useState<unknown>()

  useEffect(() => {
    const isJest = typeof jest !== 'undefined'
    if (ready) {
      try {
        if (pluginManager.current?.rootModel && !isJest) {
          destroy(pluginManager.current.rootModel)
        }
        pluginManager.current = createPluginManager(loader, reloadPluginManager)
        setPluginManagerCreated(true)
      } catch (e) {
        console.error(e)
        setError(e)
      }
    }
    return () => {
      if (pluginManager.current?.rootModel && !isJest) {
        const rootModel = pluginManager.current.rootModel
        const session = rootModel.session
        if (session) {
          loader.setSessionSnapshot(getSnapshot(session))
        }
        destroy(pluginManager.current.rootModel)
      }
    }
  }, [ready, loader, reloadPluginManager])

  const err = configError || error
  if (err) {
    return (
      <Suspense fallback={null}>
        <StartScreenErrorMessage error={err} />
      </Suspense>
    )
  } else if (sessionTriaged) {
    return <SessionTriaged loader={loader} sessionTriaged={sessionTriaged} />
  } else if (pluginManagerCreated && pluginManager.current) {
    return <JBrowse pluginManager={pluginManager.current} />
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
