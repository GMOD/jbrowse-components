import { Suspense, lazy, useCallback, useEffect, useState } from 'react'

import { FatalErrorDialog, LoadingEllipses } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { observer } from 'mobx-react'
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
import type { WebRootModel } from '../rootModel/rootModel'
import type PluginManager from '@jbrowse/core/PluginManager'

const SessionTriaged = lazy(() => import('./SessionTriaged'))
const StartScreen = lazy(() => import('./StartScreen'))
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

const PluginManagerLoaded = observer(function ({
  pluginManager,
}: {
  pluginManager: PluginManager
}) {
  const { rootModel } = pluginManager
  return !rootModel?.session ? (
    <Suspense fallback={<LoadingEllipses />}>
      <StartScreen
        rootModel={rootModel as WebRootModel}
        onFactoryReset={factoryReset}
      />
    </Suspense>
  ) : (
    <JBrowse pluginManager={pluginManager} />
  )
})

const Renderer = observer(function ({
  loader: firstLoader,
}: {
  loader: SessionLoaderModel
}) {
  const [loader, setLoader] = useState(firstLoader)
  const { configError, ready, sessionTriaged } = loader
  const [pluginManager, setPluginManager] = useState<PluginManager>()
  const [error, setError] = useState<unknown>()

  const reloadPluginManager = useCallback(
    (
      configSnapshot?: Record<string, unknown>,
      sessionSnapshot?: Record<string, unknown>,
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
    },
    [loader],
  )

  useEffect(() => {
    try {
      if (ready) {
        setPluginManager(createPluginManager(loader, reloadPluginManager))
      }
    } catch (e) {
      console.error(e)
      setError(e)
    }
  }, [loader, ready, reloadPluginManager])

  const err = configError || error
  if (err) {
    return (
      <Suspense fallback={null}>
        <StartScreenErrorMessage error={err} />
      </Suspense>
    )
  } else if (sessionTriaged) {
    return (
      <Suspense fallback={null}>
        <SessionTriaged loader={loader} sessionTriaged={sessionTriaged} />
      </Suspense>
    )
  } else if (pluginManager) {
    return <PluginManagerLoaded pluginManager={pluginManager} />
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
