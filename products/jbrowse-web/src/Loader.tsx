import React, { lazy, useEffect, useState, Suspense } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
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
import {
  writeAWSAnalytics,
  writeGAAnalytics,
} from '@jbrowse/core/util/analytics'
import { readConfObject } from '@jbrowse/core/configuration'
import Loading from './Loading'
import corePlugins from './corePlugins'
import JBrowse from './JBrowse'
import JBrowseRootModelFactory from './rootModel'
import { makeStyles } from '@material-ui/core'
import { version } from '../package.json'
import factoryReset from './factoryReset'
import SessionLoader, {
  loadSessionSpec,
  SessionLoaderModel,
} from './SessionLoader'

const SessionWarningDialog = lazy(() => import('./SessionWarningDialog'))
const ConfigWarningDialog = lazy(() => import('./ConfigWarningDialog'))
const StartScreen = lazy(() => import('./StartScreen'))

const useStyles = makeStyles(theme => ({
  message: {
    border: '1px solid black',
    overflow: 'auto',
    maxHeight: 200,
    margin: theme.spacing(1),
    padding: theme.spacing(1),
  },

  errorBox: {
    background: 'lightgrey',
    border: '1px solid black',
    margin: 20,
  },
}))

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
  const [tracks, setTracks] = useQueryParam('tracks', StringParam)
  const [loc, setLoc] = useQueryParam('loc', StringParam)
  const [assembly, setAssembly] = useQueryParam('assembly', StringParam)

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

const ErrorMessage = ({
  err,
  snapshotError,
}: {
  err: Error
  snapshotError?: string
}) => {
  const classes = useStyles()
  return (
    <div>
      <NoConfigMessage />
      {err && err.message === 'HTTP 404 fetching config.json' ? (
        <div className={classes.message} style={{ background: '#9f9' }}>
          No config detected ({`${err}`})
          <br />
          <p>
            If you want to learn how to complete your setup, visit our{' '}
            <a href="https://jbrowse.org/jb2/docs/quickstart_web">
              Quick start guide
            </a>
          </p>
        </div>
      ) : (
        <div className={classes.message} style={{ background: '#f88' }}>
          {`${err}`}
          {snapshotError ? (
            <>
              ... Failed element had snapshot:
              <pre className={classes.errorBox}>
                {JSON.stringify(JSON.parse(snapshotError), null, 2)}
              </pre>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
const SessionTriaged = observer(
  ({ loader }: { loader: SessionLoaderModel }) => {
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
  },
)

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
    const [error, setError] = useState<Error>()
    const [snapshotError, setSnapshotError] = useState('')

    // only create the pluginManager/rootModel "on mount"
    useEffect(() => {
      ;(async () => {
        try {
          const {
            runtimePlugins,
            sessionPlugins,
            adminKey,
            configSnapshot,
            sessionSnapshot,
            sessionSpec,
            configPath,
          } = loader

          if (ready) {
            // it is ready when a session has loaded and when there is no
            // config error Assuming that the query changes self.sessionError
            // or self.sessionSnapshot or self.blankSession
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
              const jbrowse = rootModel.jbrowse
              jbrowse.configuration.rpc.addDriverConfig('WebWorkerRpcDriver', {
                type: 'WebWorkerRpcDriver',
              })
              if (!configSnapshot?.configuration?.rpc?.defaultDriver) {
                jbrowse.configuration.rpc.defaultDriver.set(
                  'WebWorkerRpcDriver',
                )
              }

              let cb

              // in order: saves the previous autosave for recovery, tries to
              // load the local session if session in query, or loads the
              // default session
              if (sessionError) {
                rootModel.setDefaultSession()
                // make typescript happy by checking for session after
                // setDefaultSession, even though we know this exists now
                rootModel.session?.notify(
                  `Error loading session: ${sessionError.message}. If you
                    received this URL from another user, request that they send
                    you a session generated with the "Share" button instead of
                    copying and pasting their URL`,
                )
              } else if (sessionSnapshot && !shareWarningOpen) {
                try {
                  rootModel.setSession(sessionSnapshot)
                } catch (err) {
                  console.error(err)
                  rootModel.setDefaultSession()
                  const errorMessage = (err.message || '')
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
              } else if (sessionSpec) {
                try {
                  cb = loadSessionSpec(sessionSpec, rootModel)
                } catch (e) {
                  console.error(e)
                  rootModel.setDefaultSession()
                  rootModel.session?.notify(
                    'Failed to load session spec from URL bar',
                  )
                }
              } else {
                if (jbrowse.defaultSession?.views?.length > 0) {
                  rootModel.setDefaultSession()
                }
              }

              // send analytics
              if (!readConfObject(jbrowse.configuration, 'disableAnalytics')) {
                writeAWSAnalytics(
                  rootModel,
                  initialTimestamp,
                  initialSessionQuery,
                )
                writeGAAnalytics(rootModel, initialTimestamp)
              }

              pluginManager.setRootModel(rootModel)
              pluginManager.configure()
              setPluginManager(pluginManager)
              if (cb) {
                cb()
              }
            }
          }
        } catch (e) {
          const match = e.message.match(
            /.*at path "(.*)" snapshot `(.*)` is not assignable/,
          )
          // best effort to make a better error message than the default
          // mobx-state-tree
          if (match) {
            setError(new Error(`Failed to load element at ${match[1]}`))
            setSnapshotError(match[2])
          } else {
            setError(new Error(e.message.slice(0, 10000)))
          }
          console.error(e)
        }
      })()
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
      return <ErrorMessage err={err} snapshotError={snapshotError} />
    }
    if (loader.sessionTriaged) {
      return <SessionTriaged loader={loader} />
    }
    if (pm) {
      if (!pm.rootModel?.session) {
        return (
          <Suspense fallback={<div>Loading...</div>}>
            <StartScreen root={pm.rootModel} onFactoryReset={factoryReset} />
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
