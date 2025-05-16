import { Suspense, lazy, useCallback, useEffect, useState } from 'react'

import { FatalErrorDialog } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { observer } from 'mobx-react'
import { useQueryState } from 'nuqs'
import { NuqsAdapter } from 'nuqs/adapters/react'
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
  const [config] = useQueryState('config')
  const [session] = useQueryState('session')
  const [adminKey] = useQueryState('adminKey')
  const [password, setPassword] = useQueryState('password')
  const [loc, setLoc] = useQueryState('loc')
  const [sessionTracks, setSessionTracks] = useQueryState('sessionTracks')
  const [hubURL, setHubURL] = useQueryState('hubURL')
  const [assembly, setAssembly] = useQueryState('assembly')
  const [tracks, setTracks] = useQueryState('tracks')
  const [highlight, setHighlight] = useQueryState('highlight')
  const [nav, setNav] = useQueryState('nav')
  const [tracklist, setTrackList] = useQueryState('tracklist')
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
    setLoc(null) // eslint-disable-line @typescript-eslint/no-floating-promises
    setTracks(null) // eslint-disable-line @typescript-eslint/no-floating-promises
    setAssembly(null) // eslint-disable-line @typescript-eslint/no-floating-promises
    setPassword(null) // eslint-disable-line @typescript-eslint/no-floating-promises
    setSessionTracks(null) // eslint-disable-line @typescript-eslint/no-floating-promises
    setHubURL(null) // eslint-disable-line @typescript-eslint/no-floating-promises
    setTrackList(null) // eslint-disable-line @typescript-eslint/no-floating-promises
    setNav(null) // eslint-disable-line @typescript-eslint/no-floating-promises
    setHighlight(null) // eslint-disable-line @typescript-eslint/no-floating-promises
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
    return <SessionTriaged loader={loader} sessionTriaged={sessionTriaged} />
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
      <NuqsAdapter>
        <Loader initialTimestamp={initialTimestamp} />
      </NuqsAdapter>
    </ErrorBoundary>
  )
}

export default LoaderWrapper
