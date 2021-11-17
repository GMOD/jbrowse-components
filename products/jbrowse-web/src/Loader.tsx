/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { lazy, useEffect, useState, Suspense } from 'react'
import PluginManager, { PluginLoadRecord } from '@jbrowse/core/PluginManager'
import PluginLoader, {
  PluginDefinition,
  PluginRecord,
  isUMDPluginDefinition,
  isESMPluginDefinition,
  isCJSPluginDefinition,
} from '@jbrowse/core/PluginLoader'
import { observer } from 'mobx-react'
import { inDevelopment } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ErrorBoundary } from 'react-error-boundary'
import {
  StringParam,
  QueryParamProvider,
  useQueryParam,
} from 'use-query-params'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { types, addDisposer, Instance, SnapshotOut } from 'mobx-state-tree'
import { autorun } from 'mobx'
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

// locals
import { readSessionFromDynamo } from './sessionSharing'
import Loading from './Loading'
import corePlugins from './corePlugins'
import JBrowse from './JBrowse'
import JBrowseRootModelFactory from './rootModel'
import { fromUrlSafeB64 } from './util'
import packagedef from '../package.json'
import factoryReset from './factoryReset'

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

async function checkPlugins(pluginsToCheck: PluginDefinition[]) {
  const response = await fetch('https://jbrowse.org/plugin-store/plugins.json')
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText} fetching plugins`,
    )
  }
  const storePlugins = (await response.json()) as {
    plugins: PluginDefinition[]
  }
  return pluginsToCheck.every(p => {
    if (isUMDPluginDefinition(p)) {
      return Boolean(
        storePlugins.plugins.find(
          storePlugin =>
            isUMDPluginDefinition(storePlugin) &&
            (('url' in storePlugin &&
              'url' in p &&
              storePlugin.url === p.url) ||
              ('umdUrl' in storePlugin &&
                'umdUrl' in p &&
                storePlugin.umdUrl === p.umdUrl)),
        ),
      )
    }
    if (isESMPluginDefinition(p)) {
      return Boolean(
        storePlugins.plugins.find(
          storePlugin =>
            isESMPluginDefinition(storePlugin) &&
            storePlugin.esmUrl === p.esmUrl,
        ),
      )
    }
    if (isCJSPluginDefinition(p)) {
      return Boolean(
        storePlugins.plugins.find(
          storePlugin =>
            isCJSPluginDefinition(storePlugin) &&
            storePlugin.cjsUrl === p.cjsUrl,
        ),
      )
    }
    return false
  })
}

type Config = SnapshotOut<AnyConfigurationModel>

const SessionLoader = types
  .model({
    configPath: types.maybe(types.string),
    sessionQuery: types.maybe(types.string),
    password: types.maybe(types.string),
    adminKey: types.maybe(types.string),
  })
  .volatile(() => ({
    blankSession: false as any,
    sessionTriaged: undefined as any,
    shareWarningOpen: false as any,
    configSnapshot: undefined as any,
    sessionSnapshot: undefined as any,
    runtimePlugins: [] as PluginRecord[],
    sessionPlugins: [] as PluginRecord[],
    sessionError: undefined as unknown,
    configError: undefined as unknown,
    bc1:
      window.BroadcastChannel &&
      new window.BroadcastChannel('jb_request_session'),
    bc2:
      window.BroadcastChannel &&
      new window.BroadcastChannel('jb_respond_session'),
  }))
  .views(self => ({
    get sharedSession() {
      return self.sessionQuery?.startsWith('share-')
    },

    get encodedSession() {
      return self.sessionQuery?.startsWith('encoded-')
    },

    get jsonSession() {
      return self.sessionQuery?.startsWith('json-')
    },

    get localSession() {
      return self.sessionQuery?.startsWith('local-')
    },

    get ready() {
      return this.sessionLoaded && !self.configError
    },

    get error() {
      return self.configError || self.sessionError
    },

    get sessionLoaded() {
      return (
        !!self.sessionError || !!self.sessionSnapshot || !!self.blankSession
      )
    },
    get configLoaded() {
      return !!self.configError || !!self.configSnapshot
    },
  }))
  .actions(self => ({
    setSessionQuery(session?: any) {
      self.sessionQuery = session
    },
    setConfigError(error: unknown) {
      self.configError = error
    },
    setSessionError(error: unknown) {
      self.sessionError = error
    },
    setRuntimePlugins(plugins: PluginRecord[]) {
      self.runtimePlugins = plugins
    },
    setSessionPlugins(plugins: PluginRecord[]) {
      self.sessionPlugins = plugins
    },
    setConfigSnapshot(snap: unknown) {
      self.configSnapshot = snap
    },

    setBlankSession(flag: boolean) {
      self.blankSession = flag
    },
    setSessionTriaged(args?: {
      snap: unknown
      origin: string
      reason: PluginDefinition[]
    }) {
      self.sessionTriaged = args
    },
    setSessionSnapshotSuccess(snap: unknown) {
      self.sessionSnapshot = snap
    },
  }))
  .actions(self => ({
    async fetchPlugins(config: { plugins: PluginDefinition[] }) {
      try {
        const pluginLoader = new PluginLoader(config.plugins)
        pluginLoader.installGlobalReExports(window)
        const runtimePlugins = await pluginLoader.load()
        self.setRuntimePlugins([...runtimePlugins])
      } catch (e) {
        console.error(e)
        self.setConfigError(e)
      }
    },
    async fetchSessionPlugins(snap: { sessionPlugins?: PluginDefinition[] }) {
      try {
        const pluginLoader = new PluginLoader(snap.sessionPlugins || [])
        pluginLoader.installGlobalReExports(window)
        const plugins = await pluginLoader.load()
        self.setSessionPlugins([...plugins])
      } catch (e) {
        console.error(e)
        self.setConfigError(e)
      }
    },

    // passed
    async setSessionSnapshot(
      snap: { sessionPlugins?: PluginDefinition[] },
      userAcceptedConfirmation?: boolean,
    ) {
      try {
        const { sessionPlugins = [] } = snap
        const sessionPluginsAllowed = sessionPlugins.length
          ? await checkPlugins(sessionPlugins)
          : true
        if (sessionPluginsAllowed || userAcceptedConfirmation) {
          await this.fetchSessionPlugins(snap)
          self.setSessionSnapshotSuccess(snap)
        } else {
          self.setSessionTriaged({
            snap,
            origin: 'session',
            reason: sessionPlugins,
          })
        }
      } catch (e) {
        console.error(e)
        self.setConfigError(e)
      }
    },

    async fetchConfig() {
      const { configPath = 'config.json' } = self
      const config = JSON.parse(
        (await openLocation({
          uri: configPath,
          locationType: 'UriLocation',
        }).readFile('utf8')) as string,
      )
      const configUri = new URL(configPath, window.location.href)
      addRelativeUris(config, configUri)

      // cross origin config check
      if (configUri.hostname !== window.location.hostname) {
        const configPlugins = config.plugins || []
        const configPluginsAllowed = configPlugins.length
          ? await checkPlugins(configPlugins)
          : true
        if (!configPluginsAllowed) {
          self.setSessionTriaged({
            snap: config,
            origin: 'config',
            reason: configPlugins,
          })
        } else {
          await this.fetchPlugins(config)
          self.setConfigSnapshot(config)
        }
      } else {
        await this.fetchPlugins(config)
        self.setConfigSnapshot(config)
      }
    },

    async fetchSessionStorageSession() {
      const sessionStr = sessionStorage.getItem('current')
      const query = (self.sessionQuery as string).replace('local-', '')

      // check if
      if (sessionStr) {
        const sessionSnap = JSON.parse(sessionStr).session || {}
        if (query === sessionSnap.id) {
          await this.setSessionSnapshot(sessionSnap)
          return
        }
      }
      if (self.bc1) {
        self.bc1.postMessage(query)
        const resultP = new Promise((resolve, reject) => {
          if (self.bc2) {
            self.bc2.onmessage = msg => {
              resolve(msg.data)
            }
          }
          setTimeout(() => reject(), 1000)
        })

        try {
          const result = await resultP
          // @ts-ignore
          await self.setSessionSnapshot({ ...result, id: shortid() })
          return
        } catch (e) {
          // the broadcast channels did not find the session in another tab
          // clear session param, so just ignore
        }
      }
      throw new Error('Local storage session not found')
    },

    async fetchSharedSession() {
      // raw readConf alternative for before conf is initialized
      const readConf = (
        conf: { configuration?: { [key: string]: string } },
        attr: string,
        def: string,
      ) => {
        return (conf.configuration || {})[attr] || def
      }

      const defaultURL = 'https://share.jbrowse.org/api/v1/'
      const decryptedSession = await readSessionFromDynamo(
        `${readConf(self.configSnapshot, 'shareURL', defaultURL)}load`,
        self.sessionQuery || '',
        self.password || '',
      )

      const session = JSON.parse(await fromUrlSafeB64(decryptedSession))

      await this.setSessionSnapshot({ ...session, id: shortid() })
    },

    async decodeEncodedUrlSession() {
      const session = JSON.parse(
        // @ts-ignore
        await fromUrlSafeB64(self.sessionQuery.replace('encoded-', '')),
      )
      await this.setSessionSnapshot({ ...session, id: shortid() })
    },

    async decodeJsonUrlSession() {
      // @ts-ignore
      const session = JSON.parse(self.sessionQuery.replace('json-', ''))
      await this.setSessionSnapshot({ ...session.session, id: shortid() })
    },

    async afterCreate() {
      const {
        localSession,
        encodedSession,
        sharedSession,
        jsonSession,
        configPath,
      } = self

      try {
        // rename autosave to previousAutosave
        const lastAutosave = localStorage.getItem(`autosave-${configPath}`)
        if (lastAutosave) {
          localStorage.setItem(`previousAutosave-${configPath}`, lastAutosave)
        }
      } catch (e) {
        console.error('failed to create previousAutosave', e)
      }

      try {
        // fetch config
        await this.fetchConfig()
      } catch (e) {
        console.error(e)
        self.setConfigError(e)
        return
      }

      addDisposer(
        self,
        autorun(async () => {
          try {
            if (self.configSnapshot) {
              if (sharedSession) {
                await this.fetchSharedSession()
              } else if (encodedSession) {
                await this.decodeEncodedUrlSession()
              } else if (jsonSession) {
                await this.decodeJsonUrlSession()
              } else if (localSession) {
                await this.fetchSessionStorageSession()
              } else if (self.sessionQuery) {
                // if there was a sessionQuery and we don't recognize it
                throw new Error('unrecognized session format')
              } else {
                // placeholder for session loaded, but none found
                self.setBlankSession(true)
              }
              if (self.bc1) {
                self.bc1.onmessage = msg => {
                  const ret =
                    JSON.parse(sessionStorage.getItem('current') || '{}')
                      .session || {}
                  if (ret.id === msg.data) {
                    if (self.bc2) {
                      self.bc2.postMessage(ret)
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.error(e)
            self.setSessionError(e)
          }
        }),
      )
    },
  }))

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
  const [password] = useQueryParam('password', StringParam)
  const [adminKey] = useQueryParam('adminKey', StringParam)

  const loader = SessionLoader.create({
    configPath: load(config),
    sessionQuery: load(session),
    password: load(password),
    adminKey: load(adminKey),
  })

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
    loader: Instance<typeof SessionLoader>
    initialTimestamp: number
    initialSessionQuery: string | null | undefined
  }) => {
    const [, setPassword] = useQueryParam('password', StringParam)
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

          if (loader.configSnapshot) {
            const rootModel = JBrowseRootModel.create(
              {
                jbrowse: configSnapshot,
                assemblyManager: {},
                version: packagedef.version,
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

            // in order: saves the previous autosave for recovery, tries to
            // load the local session if session in query, or loads the default
            // session
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
              try {
                rootModel.setSession(loader.sessionSnapshot)
              } catch (err) {
                console.error(err)
                rootModel.setDefaultSession()
                const str = `${err}`
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
            } else {
              const defaultJBrowseSession = rootModel.jbrowse.defaultSession
              if (defaultJBrowseSession?.views) {
                if (defaultJBrowseSession.views.length > 0) {
                  rootModel.setDefaultSession()
                }
              }
            }

            // send analytics
            if (
              rootModel &&
              !readConfObject(
                rootModel.jbrowse.configuration,
                'disableAnalytics',
              )
            ) {
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

            // automatically clear password field once loaded
            setPassword(undefined)
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
      setPassword,
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

function addRelativeUris(config: Config, configUri: URL) {
  if (typeof config === 'object') {
    for (const key of Object.keys(config)) {
      if (typeof config[key] === 'object') {
        addRelativeUris(config[key], configUri)
      } else if (key === 'uri') {
        config.baseUri = configUri.href
      }
    }
  }
}

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

export type SessionLoader = Instance<typeof SessionLoader>
