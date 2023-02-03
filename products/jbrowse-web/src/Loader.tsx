import React, { lazy, useEffect, Suspense } from 'react'
import { observer } from 'mobx-react'
import { ErrorBoundary, FallbackProps } from 'react-error-boundary'
import {
  StringParam,
  QueryParamProvider,
  useQueryParam,
} from 'use-query-params'
import { WindowHistoryAdapter } from 'use-query-params/adapters/window'
import { LoadingEllipses, FatalErrorDialog } from '@jbrowse/core/ui'
import '@fontsource/roboto'
import 'requestidlecallback-polyfill'

// locals
import Loading from './Loading'
import JBrowse from './JBrowse'
import factoryReset from './factoryReset'
import SessionLoader, { SessionLoaderModel } from './SessionLoader'
import ConfigTriaged from './ConfigTriaged'
import SessionTriaged from './SessionTriaged'
import StartScreenErrorMessage from './StartScreenErrorMessage'

// lazy components
const StartScreen = lazy(() => import('./StartScreen'))

export const Loader = observer(function ({
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
  })

  useEffect(() => {
    setLoc(undefined)
    setTracks(undefined)
    setAssembly(undefined)
    setPassword(undefined)
    setSessionTracks(undefined)
  }, [setAssembly, setLoc, setTracks, setPassword, setSessionTracks])

  return (
    <Renderer
      loader={loader}
      initialTimestamp={initialTimestamp}
      initialSessionQuery={session}
    />
  )
})

const Renderer = observer(function ({
  loader,
  initialTimestamp,
  initialSessionQuery,
}: {
  loader: SessionLoaderModel
  initialTimestamp: number
  initialSessionQuery?: string | null
}) {
  const { configError, sessionTriaged, pluginManager: pm } = loader

  const err = configError
  if (err) {
    return <StartScreenErrorMessage error={err} />
  }

  if (sessionTriaged) {
    return sessionTriaged.origin === 'session' ? (
      <SessionTriaged
        loader={loader}
        handleClose={() => loader.setSessionTriaged(undefined)}
      />
    ) : (
      <ConfigTriaged
        loader={loader}
        handleClose={() => loader.setSessionTriaged(undefined)}
      />
    )
  }
  if (pm) {
    return !pm.rootModel?.session ? (
      <Suspense fallback={<LoadingEllipses />}>
        <StartScreen rootModel={pm.rootModel} onFactoryReset={factoryReset} />
      </Suspense>
    ) : (
      <JBrowse pluginManager={pm} />
    )
  }
  return <Loading />
})

const PlatformSpecificFatalErrorDialog = (props: FallbackProps) => {
  return (
    <FatalErrorDialog
      resetButtonText="Reset Session"
      onFactoryReset={factoryReset}
      {...props}
    />
  )
}
const LoaderWrapper = ({ initialTimestamp }: { initialTimestamp: number }) => {
  return (
    <ErrorBoundary FallbackComponent={PlatformSpecificFatalErrorDialog}>
      <QueryParamProvider adapter={WindowHistoryAdapter}>
        <Loader initialTimestamp={initialTimestamp} />
      </QueryParamProvider>
    </ErrorBoundary>
  )
}

export default LoaderWrapper
