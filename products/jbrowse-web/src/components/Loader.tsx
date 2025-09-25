import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'

import { FatalErrorDialog } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { observer } from 'mobx-react'
import { destroy } from 'mobx-state-tree'
import {
  QueryParamProvider,
  StringParam,
  useQueryParam,
} from 'use-query-params'
import { WindowHistoryAdapter } from 'use-query-params/adapters/window'

import '@fontsource/roboto'

import JBrowse from './JBrowse'
import Loading from './Loading'
import SessionLoader from '../SessionLoader'
import { createPluginManager } from '../createPluginManager'
import factoryReset from '../factoryReset'

import type { SessionLoaderModel } from '../SessionLoader'
import type PluginManager from '@jbrowse/core/PluginManager'

const SessionTriaged = lazy(() => import('./SessionTriaged'))
const StartScreenErrorMessage = lazy(() => import('./StartScreenErrorMessage'))

// return value if defined, else convert null to undefined for use with
// types.maybe
function normalize<T>(param: T | null | undefined) {
  return param === null ? undefined : param
}

export function Loader({
  initialTimestamp = Date.now(),
}: {
  initialTimestamp?: number
}) {
  const Str = StringParam

  const [config] = useQueryParam('config', Str)
  const [data] = useQueryParam('data', Str)
  const [session] = useQueryParam('session', Str)
  const [adminKey] = useQueryParam('adminKey', Str)
  const [password, setPassword] = useQueryParam('password', Str)
  const [loc, setLoc] = useQueryParam('loc', Str)
  const [sessionTracks, setSessionTracks] = useQueryParam('sessionTracks', Str)
  const [hubURL, setHubURL] = useQueryParam('hubURL', Str)
  const [assembly, setAssembly] = useQueryParam('assembly', Str)
  const [tracks, setTracks] = useQueryParam('tracks', Str)
  const [highlight, setHighlight] = useQueryParam('highlight', Str)
  const [nav, setNav] = useQueryParam('nav', Str)
  const [tracklist, setTrackList] = useQueryParam('tracklist', Str)

  const loader = SessionLoader.create({
    configPath: normalize(config),
    dataDir: normalize(data),
    sessionQuery: normalize(session),
    password: normalize(password),
    adminKey: normalize(adminKey),
    loc: normalize(loc),
    assembly: normalize(assembly),
    tracks: normalize(tracks),
    sessionTracks: normalize(sessionTracks),
    tracklist: JSON.parse(normalize(tracklist) || 'false'),
    highlight: normalize(highlight),
    nav: JSON.parse(normalize(nav) || 'true'),
    hubURL: normalize(hubURL?.split(',')),
    initialTimestamp,
  })

  useEffect(() => {
    setLoc(undefined, 'replaceIn')
    setTracks(undefined, 'replaceIn')
    setAssembly(undefined, 'replaceIn')
    setPassword(undefined, 'replaceIn')
    setSessionTracks(undefined, 'replaceIn')
    setHubURL(undefined, 'replaceIn')
    setTrackList(undefined, 'replaceIn')
    setNav(undefined, 'replaceIn')
    setHighlight(undefined, 'replaceIn')
  }, [
    setAssembly,
    setHighlight,
    setLoc,
    setNav,
    setPassword,
    setSessionTracks,
    setHubURL,
    setTrackList,
    setTracks,
  ])

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
      <QueryParamProvider adapter={WindowHistoryAdapter}>
        <Loader initialTimestamp={initialTimestamp} />
      </QueryParamProvider>
    </ErrorBoundary>
  )
}

export default LoaderWrapper
