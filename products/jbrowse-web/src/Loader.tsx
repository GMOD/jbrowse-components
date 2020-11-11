/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import PluginLoader, { PluginDefinition } from '@jbrowse/core/PluginLoader'
import { observer } from 'mobx-react'
import { inDevelopment, fromUrlSafeB64 } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import ErrorBoundary from 'react-error-boundary'
import {
  StringParam,
  useQueryParam,
  QueryParamProvider,
} from 'use-query-params'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { types, Instance, SnapshotOut } from 'mobx-state-tree'
import { PluginConstructor } from '@jbrowse/core/Plugin'
import { FatalErrorDialog } from '@jbrowse/core/ui'
import { TextDecoder, TextEncoder } from 'fastestsmallesttextencoderdecoder'
import 'fontsource-roboto'
import 'requestidlecallback-polyfill'
import 'core-js/stable'
import shortid from 'shortid'
import {
  writeAWSAnalytics,
  writeGAAnalytics,
} from '@jbrowse/core/util/analytics'
import { readConfObject } from '@jbrowse/core/configuration'
import { readSessionFromDynamo } from './sessionSharing'
import Loading from './Loading'
import corePlugins from './corePlugins'
import JBrowse from './JBrowse'
import JBrowseRootModelFactory from './rootModel'
import packagedef from '../package.json'
import factoryReset from './factoryReset'
import StartScreen from './StartScreen'

if (!window.TextEncoder) {
  window.TextEncoder = TextEncoder
}
if (!window.TextDecoder) {
  window.TextDecoder = TextDecoder
}
function NoConfigMessage() {
  const s = window.location.search
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
            {links.map(([link, name]) => (
              <li key={name}>
                <a href={`${s}${s ? '&' : '?'}config=${link}`}>{name}</a>
              </li>
            ))}
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
    configSnapshot: undefined as any,
    sessionSnapshot: undefined as any,
    plugins: [] as PluginConstructor[],
    sessionError: undefined as Error | undefined,
    configError: undefined as Error | undefined,
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
    setConfigError(error: Error) {
      self.configError = error
    },

    setSessionError(error: Error) {
      self.sessionError = error
    },
    setPlugins(plugins: PluginConstructor[]) {
      self.plugins = plugins
    },
    setConfigSnapshot(snap: unknown) {
      self.configSnapshot = snap
    },
    setSessionSnapshot(snap: unknown) {
      self.sessionSnapshot = snap
      sessionStorage.setItem('current', JSON.stringify(snap))
    },
    setBlankSession(flag: boolean) {
      self.blankSession = flag
    },
  }))
  .actions(self => ({
    async fetchPlugins(config: { plugins: PluginDefinition[] }) {
      try {
        const pluginLoader = new PluginLoader(config.plugins)
        pluginLoader.installGlobalReExports(window)
        const runtimePlugins = await pluginLoader.load()
        self.setPlugins([...corePlugins, ...runtimePlugins])
      } catch (error) {
        self.setConfigError(error)
      }
    },
    async fetchConfig() {
      try {
        const configLocation = {
          uri: self.configPath || 'config.json',
        }
        const location = openLocation(configLocation)
        const configText = (await location.readFile('utf8')) as string

        const config = JSON.parse(configText)
        const configUri = new URL(configLocation.uri, window.location.href)
        addRelativeUris(config, configUri)
        await this.fetchPlugins(config)
        self.setConfigSnapshot(config)
      } catch (error) {
        self.setConfigError(error)
      }
    },

    async fetchSessionStorageSession() {
      const sessionStr = sessionStorage.getItem('current')
      const query = (self.sessionQuery as string).replace('local-', '')

      // check if
      if (sessionStr) {
        const sessionSnap = JSON.parse(sessionStr).session || {}
        if (query === sessionSnap.id) {
          self.setSessionSnapshot(sessionSnap)
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
          self.setSessionSnapshot({ ...result, id: shortid() })
          return
        } catch (e) {
          // the broadcast channels did not find the session in another tab
          // clear session param, so just ignore
        }
      }
      self.setSessionError(new Error('Local storage session not found'))
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

      const defaultURL =
        'https://g5um1mrb0i.execute-api.us-east-1.amazonaws.com/api/v1/'
      const decryptedSession = await readSessionFromDynamo(
        `${readConf(self.configSnapshot, 'shareURL', defaultURL)}load`,
        self.sessionQuery || '',
        self.password || '',
      )

      const session = JSON.parse(fromUrlSafeB64(decryptedSession))
      self.setSessionSnapshot({ ...session, id: shortid() })
    },

    async decodeEncodedUrlSession() {
      const session = JSON.parse(
        // @ts-ignore
        fromUrlSafeB64(self.sessionQuery.replace('encoded-', '')),
      )
      self.setSessionSnapshot({ ...session, id: shortid() })
    },
    async afterCreate() {
      const { localSession, encodedSession, sharedSession, configPath } = self

      // rename autosave to previousAutosave
      const lastAutosave = localStorage.getItem(`autosave-${configPath}`)
      if (lastAutosave) {
        localStorage.setItem(`previousAutosave-${configPath}`, lastAutosave)
      }

      try {
        // fetch config
        await this.fetchConfig()
      } catch (e) {
        self.setConfigError(e)
        return
      }

      try {
        if (sharedSession) {
          await this.fetchSharedSession()
        } else if (encodedSession) {
          await this.decodeEncodedUrlSession()
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
              JSON.parse(sessionStorage.getItem('current') || '{}').session ||
              {}
            if (ret.id === msg.data) {
              if (self.bc2) {
                self.bc2.postMessage(ret)
              }
            }
          }
        }
      } catch (e) {
        self.setSessionError(e)
      }
    },
  }))

export function Loader({ initialTimestamp }: { initialTimestamp: number }) {
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
    const { sessionError, configError, ready } = loader
    const [pm, setPluginManager] = useState<PluginManager>()
    // only create the pluginManager/rootModel "on mount"
    useEffect(() => {
      const {
        plugins,
        adminKey,
        configSnapshot,
        sessionSnapshot,
        configPath,
      } = loader

      if (ready) {
        // it is ready when a session has loaded and when there is no config error
        // Assuming that the query changes self.sessionError or self.sessionSnapshot or self.blankSession
        const pluginManager = new PluginManager(plugins.map(P => new P()))

        pluginManager.createPluggableElements()

        const JBrowseRootModel = JBrowseRootModelFactory(
          pluginManager,
          !!adminKey,
        )

        if (loader.configSnapshot) {
          const rootModel = JBrowseRootModel.create({
            jbrowse: configSnapshot,
            assemblyManager: {},
            version: packagedef.version,
            configPath,
          })

          // in order: saves the previous autosave for recovery, tries to load
          // the local session if session in query, or loads the default
          // session
          if (sessionError) {
            rootModel.setDefaultSession()
            // make typescript happy by checking for session after
            // setDefaultSession, even though we know this exists now
            if (rootModel.session) {
              rootModel.session.notify(
                `Error loading session: ${sessionError.message}. If you
                received this URL from another user, request that they send you
                a session generated with the "Share" button instead of copying
                and pasting their URL`,
              )
            }
          } else if (sessionSnapshot) {
            rootModel.setSession(loader.sessionSnapshot)
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
            !readConfObject(rootModel.jbrowse.configuration, 'disableAnalytics')
          ) {
            writeAWSAnalytics(rootModel, initialTimestamp, initialSessionQuery)
            writeGAAnalytics(rootModel, initialTimestamp)
          }

          // TODO use UndoManager
          // rootModel.setHistory(
          //   UndoManager.create({}, { targetStore: rootModel.session }),
          // )

          // make some things available globally for testing e.g.
          // window.MODEL.views[0] in devtools
          // @ts-ignore
          window.MODEL = rootModel.session
          // @ts-ignore
          window.ROOTMODEL = rootModel
          pluginManager.setRootModel(rootModel)

          pluginManager.configure()
          setPluginManager(pluginManager)

          // automatically clear password field once loaded
          setPassword(undefined)
        }
      }
    }, [
      loader,
      ready,
      sessionError,
      setPassword,
      initialTimestamp,
      initialSessionQuery,
    ])

    if (configError) {
      return (
        <div>
          <NoConfigMessage />
          {configError ? (
            <div
              style={{
                border: '1px solid black',
                padding: 2,
                margin: 2,
                backgroundColor: '#ff8888',
              }}
            >{`${configError}`}</div>
          ) : null}
        </div>
      )
    }

    if (pm) {
      if (!pm.rootModel?.session) {
        return <StartScreen root={pm.rootModel} onFactoryReset={factoryReset} />
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
  return <FatalErrorDialog onFactoryReset={factoryReset} {...props} />
}
export default ({ initialTimestamp }: { initialTimestamp: number }) => {
  return (
    <ErrorBoundary FallbackComponent={PlatformSpecificFatalErrorDialog}>
      <QueryParamProvider>
        <Loader initialTimestamp={initialTimestamp} />
      </QueryParamProvider>
    </ErrorBoundary>
  )
}
