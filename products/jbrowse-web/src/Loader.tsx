import React, { lazy, useEffect, useState, Suspense } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import { observer } from 'mobx-react'
import { inDevelopment } from '@jbrowse/core/util'
import { ErrorBoundary, FallbackProps } from 'react-error-boundary'
import {
  StringParam,
  QueryParamProvider,
  useQueryParam,
} from 'use-query-params'
import { WindowHistoryAdapter } from 'use-query-params/adapters/window'
import { FatalErrorDialog } from '@jbrowse/core/ui'
import '@fontsource/roboto'
import 'requestidlecallback-polyfill'
import shortid from 'shortid'
import { doAnalytics } from '@jbrowse/core/util/analytics'

// locals
import Loading from './Loading'
import corePlugins from './corePlugins'
import JBrowse from './JBrowse'
import JBrowseRootModelFactory from './rootModel'
import packageJSON from '../package.json'
import factoryReset from './factoryReset'
import SessionLoader, {
  SessionLoaderModel,
  loadSessionSpec,
} from './SessionLoader'

// lazy components
const SessionWarningDialog = lazy(() => import('./SessionWarningDialog'))
const ConfigWarningDialog = lazy(() => import('./ConfigWarningDialog'))
const ErrorMessage = lazy(() => import('@jbrowse/core/ui/ErrorMessage'))
const StartScreen = lazy(() => import('./StartScreen'))

function NoConfigMessage() {
  const links = [
    ['test_data/volvox/config.json', 'Volvox sample data'],
    ['test_data/config.json', 'Human basic'],
    ['test_data/config_demo.json', 'Human sample data'],
    ['test_data/tomato/config.json', 'Tomato SVs'],
    ['test_data/breakpoint/config.json', 'Breakpoint'],
    ['test_data/config_dotplot.json', 'Grape/Peach dotplot'],
    ['test_data/config_synteny_grape_peach.json', 'Grape/Peach synteny'],
    ['test_data/yeast_synteny/config.json', 'Yeast synteny'],
    ['test_data/config_many_contigs.json', 'Many contigs'],
    ['test_data/config_honeybee.json', 'Honeybee'],
    ['test_data/config_wormbase.json', 'Wormbase'],
    ['test_data/wgbs/config.json', 'WGBS methylation'],
  ]
  return (
    <div>
      <h4>
        Configuration not found. You may have arrived here if you requested a
        config that does not exist or you have not set up your JBrowse yet.
      </h4>
      {inDevelopment ? (
        <>
          <div>Sample JBrowse configs:</div>
          <ul>
            {links.map(([link, name]) => {
              const { href, search } = window.location
              const { config, ...rest } = Object.fromEntries(
                new URLSearchParams(search),
              )
              const root = href.split('?')[0]
              const params = new URLSearchParams(
                Object.entries({
                  ...rest,
                  config: link,
                }),
              )
              return (
                <li key={name}>
                  <a href={`${root}?${params}`}>{name}</a>
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <>
          <div>Sample JBrowse config:</div>
          <ul>
            <li>
              <a href="?config=test_data/volvox/config.json">
                Volvox sample data
              </a>
            </li>
          </ul>
        </>
      )}
    </div>
  )
}

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
}

const SessionTriaged = ({
  loader,
  handleClose,
}: {
  loader: SessionLoaderModel
  handleClose: Function
}) => {
  return (
    <Suspense fallback={<div />}>
      <SessionWarningDialog
        onConfirm={async () => {
          const session = JSON.parse(JSON.stringify(loader.sessionTriaged.snap))

          // second param true says we passed user confirmation
          await loader.setSessionSnapshot({ ...session, id: shortid() }, true)
          handleClose()
        }}
        onCancel={() => {
          loader.setBlankSession(true)
          handleClose()
        }}
        reason={loader.sessionTriaged.reason}
      />
    </Suspense>
  )
}

const StartScreenErrorMessage = ({ error }: { error: unknown }) => {
  return (
    <>
      <NoConfigMessage />
      {`${error}`.match(/HTTP 404 fetching config.json/) ? (
        <div
          style={{
            margin: 8,
            padding: 8,
            border: '1px solid black',
            background: '#9f9',
          }}
        >
          No config.json found. If you want to learn how to complete your setup,
          visit our{' '}
          <a href="https://jbrowse.org/jb2/docs/quickstarts/quickstart_web/">
            quick start guide
          </a>
          .
        </div>
      ) : (
        <Suspense fallback={<div>Loading...</div>}>
          <ErrorMessage error={error} />
        </Suspense>
      )}
    </>
  )
}

function ConfigTriaged({
  loader,
  handleClose,
}: {
  loader: SessionLoaderModel
  handleClose: Function
}) {
  return (
    <Suspense fallback={<div />}>
      <ConfigWarningDialog
        onConfirm={async () => {
          const session = JSON.parse(JSON.stringify(loader.sessionTriaged.snap))
          await loader.fetchPlugins(session)
          loader.setConfigSnapshot({ ...session, id: shortid() })
          handleClose()
        }}
        onCancel={() => {
          factoryReset()
          handleClose()
        }}
        reason={loader.sessionTriaged.reason}
      />
    </Suspense>
  )
}

const Renderer = observer(
  ({
    loader,
    initialTimestamp,
    initialSessionQuery,
  }: {
    loader: SessionLoaderModel
    initialTimestamp: number
    initialSessionQuery?: string | null
  }) => {
    const { sessionError, configError, ready, shareWarningOpen } = loader
    const [pm, setPluginManager] = useState<PluginManager>()
    const [error, setError] = useState<unknown>()

    // only create the pluginManager/rootModel "on mount"
    useEffect(() => {
      try {
        const {
          runtimePlugins,
          sessionPlugins,
          adminKey,
          configSnapshot,
          sessionSnapshot,
          configPath,
          sessionSpec,
        } = loader

        if (ready) {
          // it is ready when a session has loaded and when there is no config
          // error Assuming that the query changes self.sessionError or
          // self.sessionSnapshot or self.blankSession
          const pluginManager = new PluginManager([
            ...corePlugins.map(P => ({
              plugin: new P(),
              metadata: { isCore: true },
            })),
            ...runtimePlugins.map(({ plugin: P, definition }) => ({
              plugin: new P(),
              definition,
              metadata: { url: definition.url },
            })),
            ...sessionPlugins.map(({ plugin: P, definition }) => ({
              plugin: new P(),
              definition,
              metadata: { url: definition.url },
            })),
          ])
          pluginManager.createPluggableElements()
          const RootModel = JBrowseRootModelFactory(pluginManager, !!adminKey)

          if (configSnapshot) {
            const rootModel = RootModel.create(
              {
                jbrowse: configSnapshot,
                version: packageJSON.version,
                configPath,
              },
              { pluginManager },
            )
            if (
              !rootModel.jbrowse.configuration.rpc.drivers.get(
                'WebWorkerRpcDriver',
              )
            ) {
              rootModel.jbrowse.configuration.rpc.addDriverConfig(
                'WebWorkerRpcDriver',
                { type: 'WebWorkerRpcDriver' },
              )
            }
            if (!loader.configSnapshot?.configuration?.rpc?.defaultDriver) {
              rootModel.jbrowse.configuration.rpc.defaultDriver.set(
                'WebWorkerRpcDriver',
              )
            }

            let afterInitializedCb = () => {}

            // in order: saves the previous autosave for recovery, tries to
            // load the local session if session in query, or loads the default
            // session
            try {
              if (sessionError) {
                rootModel.setDefaultSession()
                // make typescript happy by checking for session after
                // setDefaultSession, even though we know this exists now
                if (rootModel.session) {
                  rootModel.session.notify(
                    `Error loading session: ${sessionError}. If you
                received this URL from another user, request that they send you
                a session generated with the "Share" button instead of copying
                and pasting their URL`,
                  )
                }
              } else if (sessionSnapshot && !shareWarningOpen) {
                rootModel.setSession(sessionSnapshot)
              } else if (sessionSpec) {
                afterInitializedCb = loadSessionSpec(sessionSpec, pluginManager)
              } else if (rootModel.jbrowse.defaultSession?.views?.length) {
                rootModel.setDefaultSession()
              }
            } catch (e) {
              rootModel.setDefaultSession()
              const str = `${e}`
              const errorMessage = str
                .replace('[mobx-state-tree] ', '')
                .replace(/\(.+/, '')
              rootModel.session?.notify(
                `Session could not be loaded. ${
                  errorMessage.length > 1000
                    ? `${errorMessage.slice(0, 1000)}...see more in console`
                    : errorMessage
                }`,
              )
              console.error(e)
            }

            // send analytics
            doAnalytics(rootModel, initialTimestamp, initialSessionQuery)

            pluginManager.setRootModel(rootModel)
            pluginManager.configure()
            setPluginManager(pluginManager)
            afterInitializedCb()
          }
        }
      } catch (e) {
        setError(e)
        console.error(e)
      }
    }, [
      loader,
      shareWarningOpen,
      ready,
      sessionError,
      initialTimestamp,
      initialSessionQuery,
    ])

    const err = configError || error

    if (err) {
      return <StartScreenErrorMessage error={err} />
    }

    if (loader.sessionTriaged) {
      return loader.sessionTriaged.origin === 'session' ? (
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
        <Suspense fallback={<div>Loading...</div>}>
          <StartScreen rootModel={pm.rootModel} onFactoryReset={factoryReset} />
        </Suspense>
      ) : (
        <JBrowse pluginManager={pm} />
      )
    }
    return <Loading />
  },
)

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
    // @ts-ignore
    <ErrorBoundary FallbackComponent={PlatformSpecificFatalErrorDialog}>
      <QueryParamProvider adapter={WindowHistoryAdapter}>
        <Loader initialTimestamp={initialTimestamp} />
      </QueryParamProvider>
    </ErrorBoundary>
  )
}

export default LoaderWrapper
