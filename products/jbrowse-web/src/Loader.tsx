import React, { lazy, useEffect, useState, Suspense } from 'react'
import PluginManager, { PluginLoadRecord } from '@jbrowse/core/PluginManager'
import { observer } from 'mobx-react'
import { inDevelopment } from '@jbrowse/core/util'
import { ErrorBoundary } from 'react-error-boundary'
import {
  StringParam,
  QueryParamProvider,
  useQueryParam,
} from 'use-query-params'
import { FatalErrorDialog } from '@jbrowse/core/ui'
import 'fontsource-roboto'
import 'requestidlecallback-polyfill'
import 'core-js/stable'
import queryString from 'query-string'
import shortid from 'shortid'
import { doAnalytics } from '@jbrowse/core/util/analytics'

// locals
import Loading from './Loading'
import corePlugins from './corePlugins'
import JBrowse from './JBrowse'
import JBrowseRootModelFactory from './rootModel'
import { version } from '../package.json'
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

      <p>
        If you want to complete your setup, visit our{' '}
        <a href="https://jbrowse.org/jb2/docs/quickstart_web">
          Quick start guide
        </a>
      </p>

      {inDevelopment ? (
        <>
          <div>Sample JBrowse configs:</div>
          <ul>
            {links.map(([link, name]) => {
              const { href, search } = window.location
              const { config, ...rest } = queryString.parse(search)
              const root = href.split('?')[0]
              const params = queryString.stringify({
                ...rest,
                config: link,
              })
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

  const [config] = useQueryParam('config', StringParam)
  const [session] = useQueryParam('session', StringParam)
  const [adminKey] = useQueryParam('adminKey', StringParam)
  const [password, setPassword] = useQueryParam('password', StringParam)
  const [loc, setLoc] = useQueryParam('loc', StringParam)
  const [assembly, setAssembly] = useQueryParam('assembly', StringParam)
  const [tracks, setTracks] = useQueryParam('tracks', StringParam)

  const loader = SessionLoader.create({
    configPath: load(config),
    sessionQuery: load(session),
    password: load(password),
    adminKey: load(adminKey),
    loc: load(loc),
    assembly: load(assembly),
    tracks: load(tracks),
  })

  useEffect(() => {
    setLoc(undefined)
    setTracks(undefined)
    setAssembly(undefined)
    setPassword(undefined)
  }, [setAssembly, setLoc, setTracks, setPassword])

  return (
    <Renderer
      loader={loader}
      initialTimestamp={initialTimestamp}
      initialSessionQuery={session}
    />
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
    initialSessionQuery: string | null | undefined
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
            ...corePlugins.map(P => {
              return {
                plugin: new P(),
                metadata: { isCore: true },
              } as PluginLoadRecord
            }),
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

          const JBrowseRootModel = JBrowseRootModelFactory(
            pluginManager,
            !!adminKey,
          )

          if (configSnapshot) {
            const rootModel = JBrowseRootModel.create(
              {
                jbrowse: configSnapshot,
                assemblyManager: {},
                version,
                configPath,
              },
              { pluginManager },
            )
            rootModel.jbrowse.configuration.rpc.addDriverConfig(
              'WebWorkerRpcDriver',
              { type: 'WebWorkerRpcDriver' },
            )
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
                afterInitializedCb = loadSessionSpec(sessionSpec, rootModel)
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
      return (
        <>
          <NoConfigMessage />
          {`${err}`.match(/HTTP 404 fetching config.json/) ? (
            <div
              style={{
                margin: 8,
                padding: 8,
                border: '1px solid black',
                background: '#9f9',
              }}
            >
              No config.json found. If you want to learn how to complete your
              setup, visit our{' '}
              <a href="https://jbrowse.org/jb2/docs/quickstart_web">
                Quick start guide
              </a>
            </div>
          ) : (
            <Suspense fallback={<div>Loading...</div>}>
              <ErrorMessage error={err} />
            </Suspense>
          )}
        </>
      )
    }

    if (loader.sessionTriaged) {
      const handleClose = () => {
        loader.setSessionTriaged(undefined)
      }
      return loader.sessionTriaged.origin === 'session' ? (
        <Suspense fallback={<div />}>
          <SessionWarningDialog
            onConfirm={async () => {
              const session = JSON.parse(
                JSON.stringify(loader.sessionTriaged.snap),
              )

              // second param true says we passed user confirmation
              await loader.setSessionSnapshot(
                { ...session, id: shortid() },
                true,
              )
              handleClose()
            }}
            onCancel={() => {
              loader.setBlankSession(true)
              handleClose()
            }}
            reason={loader.sessionTriaged.reason}
          />
        </Suspense>
      ) : (
        <Suspense fallback={<div />}>
          <ConfigWarningDialog
            onConfirm={async () => {
              const session = JSON.parse(
                JSON.stringify(loader.sessionTriaged.snap),
              )
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
    if (pm) {
      if (!pm.rootModel?.session) {
        return (
          <Suspense fallback={<div>Loading...</div>}>
            <StartScreen
              rootModel={pm.rootModel}
              onFactoryReset={factoryReset}
            />
          </Suspense>
        )
      }
      return <JBrowse pluginManager={pm} />
    }
    return <Loading />
  },
)

const PlatformSpecificFatalErrorDialog = (props: unknown) => {
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
      <QueryParamProvider>
        <Loader initialTimestamp={initialTimestamp} />
      </QueryParamProvider>
    </ErrorBoundary>
  )
}

export default LoaderWrapper
