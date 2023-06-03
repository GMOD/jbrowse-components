import React, { lazy, useEffect, useState, Suspense } from 'react'
import { observer } from 'mobx-react'
import { ErrorBoundary } from 'react-error-boundary'
import {
  StringParam,
  QueryParamProvider,
  useQueryParam,
} from 'use-query-params'
import { WindowHistoryAdapter } from 'use-query-params/adapters/window'
import { FatalErrorDialog, LoadingEllipses } from '@jbrowse/core/ui'
import '@fontsource/roboto'

// locals
import Loading from './Loading'
import JBrowse from './JBrowse'
import factoryReset from '../factoryReset'
import SessionLoader, { SessionLoaderModel } from '../SessionLoader'
import StartScreenErrorMessage from './StartScreenErrorMessage'
import PluginManager from '@jbrowse/core/PluginManager'
import { createPluginManager } from '../createPluginManager'

const ConfigTriaged = lazy(() => import('./ConfigWarningDialog'))
const SessionTriaged = lazy(() => import('./SessionWarningDialog'))
const StartScreen = lazy(() => import('./StartScreen'))

export function Loader({
  initialTimestamp = Date.now(),
}: {
  initialTimestamp?: number
}) {
  // return value if defined, else convert null to undefined for use with
  // types.maybe
  const load = (param: string | null | undefined) =>
    param === null ? undefined : param

  const Str = StringParam

  const [config] = useQueryParam('config', Str)
  const [session] = useQueryParam('session', Str)
  const [adminKey] = useQueryParam('adminKey', Str)
  const [password, setPassword] = useQueryParam('password', Str)
  const [loc, setLoc] = useQueryParam('loc', Str)
  const [sessionTracks, setSessionTracks] = useQueryParam('sessionTracks', Str)
  const [assembly, setAssembly] = useQueryParam('assembly', Str)
  const [tracks, setTracks] = useQueryParam('tracks', Str)

  const loader = SessionLoader.create({
    configPath: load(config),
    sessionQuery: load(session),
    password: load(password),
    adminKey: load(adminKey),
    loc: load(loc),
    assembly: load(assembly),
    tracks: load(tracks),
    sessionTracks: load(sessionTracks),
    initialTimestamp,
  })

  useEffect(() => {
    setLoc(undefined)
    setTracks(undefined)
    setAssembly(undefined)
    setPassword(undefined)
    setSessionTracks(undefined)
  }, [setAssembly, setLoc, setTracks, setPassword, setSessionTracks])

  return <Renderer loader={loader} />
}

const Renderer = observer(function ({
  loader,
}: {
  loader: SessionLoaderModel
}) {
  const { configError, ready, shareWarningOpen } = loader
  const [pluginManager, setPluginManager] = useState<PluginManager>()
  const [error, setError] = useState<unknown>()

  useEffect(() => {
    try {
      if (!ready || shareWarningOpen) {
        return
      }
      const pm = createPluginManager(loader)
      setPluginManager(pm)
    } catch (e) {
      console.error(e)
      setError(e)
    }
  }, [loader, ready, shareWarningOpen])
  if (configError || error) {
    return <StartScreenErrorMessage error={configError || error} />
  }

  if (loader.sessionTriaged) {
    return (
      <Suspense fallback={<React.Fragment />}>
        {loader.sessionTriaged.origin === 'session' ? (
          <SessionTriaged
            loader={loader}
            handleClose={() => loader.setSessionTriaged(undefined)}
          />
        ) : (
          <ConfigTriaged
            loader={loader}
            handleClose={() => loader.setSessionTriaged(undefined)}
          />
        )}
      </Suspense>
    )
  }
  if (pluginManager) {
    return !pluginManager.rootModel?.session ? (
      <Suspense fallback={<LoadingEllipses />}>
        <StartScreen
          rootModel={pluginManager.rootModel}
          onFactoryReset={factoryReset}
        />
      </Suspense>
    ) : (
      <JBrowse pluginManager={pluginManager} />
    )
  }
  return <Loading />
})

const LoaderWrapper = ({ initialTimestamp }: { initialTimestamp: number }) => {
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
