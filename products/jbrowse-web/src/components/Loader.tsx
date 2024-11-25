import React, { lazy, useEffect, useState, Suspense } from 'react'
import { FatalErrorDialog, LoadingEllipses } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { observer } from 'mobx-react'
import {
  StringParam,
  QueryParamProvider,
  useQueryParam,
} from 'use-query-params'
import { WindowHistoryAdapter } from 'use-query-params/adapters/window'
import '@fontsource/roboto'

// locals
import JBrowse from './JBrowse'
import Loading from './Loading'
import SessionLoader from '../SessionLoader'
import factoryReset from '../factoryReset'
import StartScreenErrorMessage from './StartScreenErrorMessage'
import { createPluginManager } from '../createPluginManager'
import type { SessionLoaderModel, SessionTriagedInfo } from '../SessionLoader'
import type { WebRootModel } from '../rootModel/rootModel'
import type PluginManager from '@jbrowse/core/PluginManager'

const ConfigWarningDialog = lazy(() => import('./ConfigWarningDialog'))
const SessionWarningDialog = lazy(() => import('./SessionWarningDialog'))
const StartScreen = lazy(() => import('./StartScreen'))

function normalize<T>(param: T | null | undefined) {
  return param === null ? undefined : param
}

export function Loader({
  initialTimestamp = Date.now(),
}: {
  initialTimestamp?: number
}) {
  // return value if defined, else convert null to undefined for use with
  // types.maybe

  const Str = StringParam

  const [config] = useQueryParam('config', Str)
  const [session] = useQueryParam('session', Str)
  const [adminKey] = useQueryParam('adminKey', Str)
  const [password, setPassword] = useQueryParam('password', Str)
  const [loc, setLoc] = useQueryParam('loc', Str)
  const [sessionTracks, setSessionTracks] = useQueryParam('sessionTracks', Str)
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
    initialTimestamp,
  })

  useEffect(() => {
    setLoc(undefined, 'replaceIn')
    setTracks(undefined, 'replaceIn')
    setAssembly(undefined, 'replaceIn')
    setPassword(undefined, 'replaceIn')
    setSessionTracks(undefined, 'replaceIn')
    setTrackList(undefined, 'replaceIn')
    setNav(undefined, 'replaceIn')
    setHighlight(undefined, 'replaceIn')
  }, [
    setAssembly,
    setLoc,
    setNav,
    setTrackList,
    setTracks,
    setPassword,
    setSessionTracks,
    setHighlight,
  ])

  return <Renderer loader={loader} />
}

const SessionTriaged = observer(function ({
  sessionTriaged,
  loader,
}: {
  loader: SessionLoaderModel
  sessionTriaged: SessionTriagedInfo
}) {
  return (
    <Suspense fallback={null}>
      {sessionTriaged.origin === 'session' ? (
        <SessionWarningDialog
          loader={loader}
          handleClose={() => {
            loader.setSessionTriaged(undefined)
          }}
        />
      ) : (
        <ConfigWarningDialog
          loader={loader}
          handleClose={() => {
            loader.setSessionTriaged(undefined)
          }}
        />
      )}
    </Suspense>
  )
})

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
  loader,
}: {
  loader: SessionLoaderModel
}) {
  const { configError, ready, sessionTriaged } = loader
  const [pluginManager, setPluginManager] = useState<PluginManager>()
  const [error, setError] = useState<unknown>()

  useEffect(() => {
    let pm: PluginManager | undefined
    try {
      if (!ready) {
        return
      }
      pm = createPluginManager(loader)
      setPluginManager(pm)
    } catch (e) {
      console.error(e)
      setError(e)
    }
  }, [loader, ready])

  const err = configError || error
  if (err) {
    return <StartScreenErrorMessage error={err} />
  } else if (sessionTriaged) {
    return <SessionTriaged loader={loader} sessionTriaged={sessionTriaged} />
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
