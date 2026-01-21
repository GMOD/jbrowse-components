/**
 * The pluginManager/rootModel can be destroyed and recreated without a full
 * page reload. Plugin install passes the session explicitly via the
 * reloadPluginManager callback. HMR uses a different mechanism: the useEffect
 * cleanup saves the current session to the loader before destroying, so
 * createPluginManager can restore it.
 */
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'

import { FatalErrorDialog } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { destroy, getSnapshot, isAlive } from '@jbrowse/mobx-state-tree'
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
  loader: firstLoader,
}: {
  loader: SessionLoaderModel
}) {
  // Store loader in state so reloadPluginManager can replace it
  const [loader, setLoader] = useState(firstLoader)
  const pluginManager = useRef<PluginManager | undefined>(undefined)
  const [pluginManagerCreated, setPluginManagerCreated] = useState(false)

  // Called by rootModel when plugins are installed/removed. Creates a new
  // loader with the updated config and current session, triggering a full
  // pluginManager recreation.
  const reloadPluginManager = useCallback(
    (
      configSnapshot: Record<string, unknown>,
      sessionSnapshot: Record<string, unknown>,
    ) => {
      const newLoader = SessionLoader.create({
        configPath: loader.configPath,
        sessionQuery: loader.sessionQuery,
        password: loader.password,
        adminKey: loader.adminKey,
        loc: loader.loc,
        assembly: loader.assembly,
        tracks: loader.tracks,
        sessionTracks: loader.sessionTracks,
        tracklist: loader.tracklist,
        highlight: loader.highlight,
        nav: loader.nav,
        hubURL: loader.hubURL,
        initialTimestamp: Date.now(),
        configSnapshot,
        sessionSnapshot,
      })
      setLoader(newLoader)
      setPluginManagerCreated(false)
    },
    [loader],
  )
  const { configError, ready, sessionTriaged } = loader
  const [error, setError] = useState<unknown>()

  useEffect(() => {
    // Skip destroy in Jest since it interferes with test cleanup
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
        // Note: isAlive check crucial because if not a 'dead' session is
        // snapshotted and the safeReference in activeWidgets is stripped from
        // the snapshot (xref #5414)
        if (session && isAlive(session)) {
          // Save session before destroying so it can be restored on next
          // effect run. This is essential for HMR where the same loader is
          // reused. For plugin reload via reloadPluginManagerCallback, this
          // writes to the old loader (captured in this closure) which is
          // discarded - the new loader already has sessionSnapshot pre-set.
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
