/**
 * The pluginManager/rootModel can be destroyed and recreated without a full
 * page reload. This implementation uses an imperative approach where
 * reloadPluginManager directly manages the transition: it destroys the old
 * rootModel, creates a new loader, waits for it to be ready, then creates the
 * new pluginManager. This linear flow is easier to reason about than reactive
 * state changes triggering effects.
 */
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react'

import { FatalErrorDialog } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { destroy, getSnapshot } from '@jbrowse/mobx-state-tree'
import { when } from 'mobx'
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

const isJest = typeof jest !== 'undefined'

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

  const queryParamsRef = useRef(() => {
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

  const [loader] = useState(() =>
    SessionLoader.create({
      ...queryParamsRef.current(),
      initialTimestamp,
    }),
  )

  useEffect(() => {
    deleteQueryParams([...paramsToDelete])
  }, [])

  return (
    <Renderer loader={loader} queryParamsRef={queryParamsRef} />
  )
}

const Renderer = observer(function Renderer({
  loader: initialLoader,
  queryParamsRef,
}: {
  loader: SessionLoaderModel
  queryParamsRef: React.RefObject<() => {
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
  }>
}) {
  const loaderRef = useRef(initialLoader)
  const pluginManagerRef = useRef<PluginManager | undefined>(undefined)
  const [, forceUpdate] = useReducer(x => x + 1, 0)
  const [error, setError] = useState<unknown>()

  // Called by rootModel when plugins are installed/removed. Imperatively
  // handles the entire transition: destroy old, create new loader, wait for
  // ready, create new pluginManager.
  const reloadPluginManager = useCallback(
    async (
      configSnapshot: Record<string, unknown>,
      sessionSnapshot: Record<string, unknown>,
    ) => {
      try {
        // 1. Destroy the old rootModel immediately (no need to save session -
        //    it's passed to us)
        if (pluginManagerRef.current?.rootModel && !isJest) {
          destroy(pluginManagerRef.current.rootModel)
        }
        pluginManagerRef.current = undefined
        forceUpdate()

        // 2. Create new loader with the snapshots
        const newLoader = SessionLoader.create({
          ...queryParamsRef.current(),
          initialTimestamp: Date.now(),
          configSnapshot,
          sessionSnapshot,
        })
        loaderRef.current = newLoader
        forceUpdate()

        // 3. Wait for the loader to be ready
        await when(() => newLoader.ready || !!newLoader.error)

        if (newLoader.error) {
          setError(newLoader.error)
          return
        }

        // 4. Create the new pluginManager
        pluginManagerRef.current = createPluginManager(
          newLoader,
          reloadPluginManager,
        )
        forceUpdate()
      } catch (e) {
        console.error(e)
        setError(e)
      }
    },
    [queryParamsRef],
  )

  const loader = loaderRef.current
  const { configError, ready, sessionTriaged } = loader

  // Initial setup: wait for loader to be ready and create pluginManager
  useEffect(() => {
    if (ready && !pluginManagerRef.current) {
      try {
        pluginManagerRef.current = createPluginManager(loader, reloadPluginManager)
        forceUpdate()
      } catch (e) {
        console.error(e)
        setError(e)
      }
    }
  }, [ready, loader, reloadPluginManager])

  // Cleanup on unmount (for HMR)
  useEffect(() => {
    return () => {
      if (pluginManagerRef.current?.rootModel && !isJest) {
        const rootModel = pluginManagerRef.current.rootModel
        const session = rootModel.session
        if (session) {
          loaderRef.current.setSessionSnapshot(getSnapshot(session))
        }
        destroy(pluginManagerRef.current.rootModel)
      }
    }
  }, [])

  const err = configError || error
  if (err) {
    return (
      <Suspense fallback={null}>
        <StartScreenErrorMessage error={err} />
      </Suspense>
    )
  } else if (sessionTriaged) {
    return <SessionTriaged loader={loader} sessionTriaged={sessionTriaged} />
  } else if (pluginManagerRef.current) {
    return <JBrowse pluginManager={pluginManagerRef.current} />
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
