/**
 * The pluginManager/rootModel can be destroyed and recreated without a full
 * page reload. Plugin install triggers a key-based remount by incrementing
 * reloadKey, which causes React to unmount and remount Renderer with fresh
 * state. The config and session snapshots are stored in refs to survive the
 * remount. HMR saves the current session to the loader in useEffect cleanup.
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

  const queryParams = useRef(() => {
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
    return {
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
    }
  })

  // Refs to store snapshots for reload - survive across Renderer remounts
  const configSnapshotRef = useRef<Record<string, unknown>>()
  const sessionSnapshotRef = useRef<Record<string, unknown>>()
  const [reloadKey, setReloadKey] = useState(0)

  // Called by rootModel when plugins are installed/removed. Stores snapshots
  // and increments key to trigger Renderer remount with fresh loader.
  const reloadPluginManager = useCallback(
    (
      configSnapshot: Record<string, unknown>,
      sessionSnapshot: Record<string, unknown>,
    ) => {
      configSnapshotRef.current = configSnapshot
      sessionSnapshotRef.current = sessionSnapshot
      setReloadKey(k => k + 1)
    },
    [],
  )

  useEffect(() => {
    deleteQueryParams([...paramsToDelete])
  }, [])

  return (
    <Renderer
      key={reloadKey}
      queryParams={queryParams.current()}
      initialTimestamp={initialTimestamp}
      configSnapshot={configSnapshotRef.current}
      sessionSnapshot={sessionSnapshotRef.current}
      reloadPluginManager={reloadPluginManager}
    />
  )
}

const Renderer = observer(function Renderer({
  queryParams,
  initialTimestamp,
  configSnapshot,
  sessionSnapshot,
  reloadPluginManager,
}: {
  queryParams: {
    configPath: string | undefined
    sessionQuery: string | undefined
    password: string | undefined
    adminKey: string | undefined
    loc: string | undefined
    assembly: string | undefined
    tracks: string | undefined
    sessionTracks: string | undefined
    tracklist: boolean
    highlight: string | undefined
    nav: boolean
    hubURL: string[] | undefined
  }
  initialTimestamp: number
  configSnapshot: Record<string, unknown> | undefined
  sessionSnapshot: Record<string, unknown> | undefined
  reloadPluginManager: (
    configSnapshot: Record<string, unknown>,
    sessionSnapshot: Record<string, unknown>,
  ) => void
}) {
  const [loader] = useState(() =>
    SessionLoader.create({
      ...queryParams,
      initialTimestamp,
      configSnapshot,
      sessionSnapshot,
    }),
  )

  const pluginManager = useRef<PluginManager | undefined>(undefined)
  const [pluginManagerCreated, setPluginManagerCreated] = useState(false)
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
