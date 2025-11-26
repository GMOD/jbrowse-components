import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'

import { FatalErrorDialog } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { observer } from 'mobx-react'
import { destroy } from 'mobx-state-tree'

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

const Renderer = observer(function ({
  loader: firstLoader,
}: {
  loader: SessionLoaderModel
}) {
  const [loader, setLoader] = useState(firstLoader)
  const pluginManager = useRef<PluginManager | undefined>(undefined)
  const [pluginManagerCreated, setPluginManagerCreated] = useState(false)
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
