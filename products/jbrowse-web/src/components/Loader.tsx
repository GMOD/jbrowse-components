import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'

import { FatalErrorDialog } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { destroy, getSnapshot } from '@jbrowse/mobx-state-tree'
import { observer } from 'mobx-react'

import '@fontsource/roboto'

import JBrowse from './JBrowse'
import Loading from './Loading'
import SessionLoader from '../SessionLoader'
import { createPluginManager } from '../createPluginManager'
import factoryReset from '../factoryReset'
import { deleteQueryParams, readQueryParams } from '../useQueryParam'

import type { SessionLoaderModel } from '../SessionLoader'
import type PluginManager from '@jbrowse/core/PluginManager'

const SessionTriaged = lazy(() => import('./SessionTriaged'))
const StartScreenErrorMessage = lazy(() => import('./StartScreenErrorMessage'))

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

console.log(
  '[Loader] Module loaded/reloaded at:',
  new Date().toISOString(),
  '- HMR debug v5 with fix',
)

export function Loader({
  initialTimestamp: initialTimestampProp,
}: {
  initialTimestamp?: number
}) {
  console.log(
    '[Loader] Component initializing, initialTimestampProp:',
    initialTimestampProp,
  )
  const [initialTimestamp] = useState(() => initialTimestampProp ?? Date.now())

  const [loader] = useState(() => {
    console.log(
      '[Loader] Creating SessionLoader state, initialTimestamp:',
      initialTimestamp,
    )
    const queryParams = readQueryParams([
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
    } = queryParams
    console.log('[Loader] Query params read:', queryParams)
    console.log(
      '[Loader] sessionStorage current:',
      sessionStorage.getItem('current')?.slice(0, 200),
    )
    console.log('[Loader] localStorage keys:', Object.keys(localStorage))

    const loaderInstance = SessionLoader.create({
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
    console.log('[Loader] SessionLoader created:', loaderInstance)
    return loaderInstance
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
  console.log('[Renderer] Component rendering, firstLoader:', firstLoader)
  const [loader, setLoader] = useState(firstLoader)
  const pluginManager = useRef<PluginManager | undefined>(undefined)
  const [pluginManagerCreated, setPluginManagerCreated] = useState(false)
  const reloadPluginManager = useCallback(
    (
      configSnapshot: Record<string, unknown>,
      sessionSnapshot: Record<string, unknown>,
    ) => {
      console.log('[Renderer] reloadPluginManager called')
      console.log(
        '[Renderer] configSnapshot:',
        JSON.stringify(configSnapshot).slice(0, 200),
      )
      console.log(
        '[Renderer] sessionSnapshot:',
        JSON.stringify(sessionSnapshot).slice(0, 200),
      )
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
      console.log('[Renderer] newLoader created:', newLoader)
      setLoader(newLoader)
      setPluginManagerCreated(false)
    },
    [loader],
  )
  const { configError, ready, sessionTriaged } = loader
  const [error, setError] = useState<unknown>()

  console.log(
    '[Renderer] loader state - ready:',
    ready,
    'configError:',
    configError,
    'sessionTriaged:',
    sessionTriaged,
  )

  useEffect(() => {
    console.log(
      '[Renderer] useEffect triggered - ready:',
      ready,
      'loader:',
      loader,
    )
    const isJest = typeof jest !== 'undefined'
    if (ready) {
      try {
        console.log(
          '[Renderer] ready=true, pluginManager.current?.rootModel:',
          pluginManager.current?.rootModel,
        )
        if (pluginManager.current?.rootModel && !isJest) {
          console.log('[Renderer] Destroying existing rootModel')
          destroy(pluginManager.current.rootModel)
        }
        console.log('[Renderer] Creating new pluginManager')
        pluginManager.current = createPluginManager(loader, reloadPluginManager)
        console.log('[Renderer] pluginManager created:', pluginManager.current)
        setPluginManagerCreated(true)
      } catch (e) {
        console.error('[Renderer] Error creating pluginManager:', e)
        setError(e)
      }
    }
    return () => {
      console.log(
        '[Renderer] useEffect cleanup - pluginManager.current?.rootModel:',
        pluginManager.current?.rootModel,
      )
      if (pluginManager.current?.rootModel && !isJest) {
        const rootModel = pluginManager.current.rootModel
        // @ts-expect-error
        const session = rootModel.session
        if (session) {
          const sessionSnap = getSnapshot(session)
          console.log(
            '[Renderer] Cleanup: Current session being destroyed - id:',
            sessionSnap.id,
          )
          console.log('[Renderer] Cleanup: Session name:', sessionSnap.name)
          console.log(
            '[Renderer] Cleanup: Session views count:',
            sessionSnap.views?.length,
          )
          // Save current session to loader so it can be restored after HMR
          console.log(
            '[Renderer] Cleanup: Saving session to loader for HMR recovery',
          )
          loader.setSessionSnapshot(sessionSnap)
          loader.setBlankSession(false)
        }
        console.log('[Renderer] Cleanup: Destroying rootModel')
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
