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
import * as crypto from 'crypto'
import 'typeface-roboto'
import 'requestidlecallback-polyfill'
import 'core-js/stable'
import shortid from 'shortid'
import history from './history'
import { readSessionFromDynamo } from './sessionSharing'
import Loading from './Loading'
import corePlugins from './corePlugins'
import JBrowse from './JBrowse'
import JBrowseRootModelFactory from './rootModel'
import packagedef from '../package.json'

if (!window.TextEncoder) {
  window.TextEncoder = TextEncoder
}
if (!window.TextDecoder) {
  window.TextDecoder = TextDecoder
}
function NoConfigMessage() {
  // TODO: Link to docs for how to configure JBrowse
  return (
    <>
      <h4>JBrowse has not been configured yet.</h4>
      {inDevelopment ? (
        <>
          <div>Available development configs:</div>
          <ul>
            <li>
              <a href="?config=test_data/config.json">Human basic</a>
            </li>
            <li>
              <a href="?config=test_data/config_demo.json">Human extended</a>
            </li>
            <li>
              <a href="?config=test_data/tomato/config.json">Tomato SVs</a>
            </li>
            <li>
              <a href="?config=test_data/volvox/config.json">Volvox</a>
            </li>
            <li>
              <a href="?config=test_data/breakpoint/config.json">Breakpoint</a>
            </li>
            <li>
              <a href="?config=test_data/config_dotplot.json">
                Grape/Peach Dotplot
              </a>
            </li>
            <li>
              <a href="?config=test_data/config_human_dotplot.json">
                hg19/hg38 Dotplot
              </a>
            </li>
            <li>
              <a href="?config=test_data/config_synteny_grape_peach.json">
                Grape/Peach Synteny
              </a>
            </li>
            <li>
              <a href="?config=test_data/yeast_synteny/config.json">
                Yeast Synteny
              </a>
            </li>
            <li>
              <a href="?config=test_data/config_longread.json">
                Long Read vs. Reference Dotplot
              </a>
            </li>
            <li>
              <a href="?config=test_data/config_longread_linear.json">
                Long Read vs. Reference Linear
              </a>
            </li>
            <li>
              <a href="?config=test_data/config_many_contigs.json">
                Many Contigs
              </a>
            </li>
            <li>
              <a href="?config=test_data/config_honeybee.json">Honeybee</a>
            </li>
          </ul>
        </>
      ) : null}
    </>
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
    noDefaultConfig: false,
    sessionLoaded: false, // is session loading e.g. from remote shared URL
    configLoaded: false, // is config loading e.g. downloading json config
    configSnapshot: undefined as any,
    sessionSnapshot: undefined as any,
    plugins: [] as PluginConstructor[],
    error: undefined as Error | undefined,
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

    get localSession() {
      return self.sessionQuery?.startsWith('local-')
    },

    get ready() {
      return self.configLoaded && self.sessionLoaded
    },
  }))
  .actions(self => ({
    setSessionQuery(session?: any) {
      self.sessionQuery = session
    },
    setError(error: Error) {
      self.error = error
    },
    setSessionLoaded(flag: boolean) {
      self.sessionLoaded = flag
    },
    setConfigLoaded(flag: boolean) {
      self.configLoaded = flag
    },
    setNoDefaultConfig(flag: boolean) {
      self.noDefaultConfig = flag
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
  }))
  .actions(self => ({
    async fetchPlugins(config: { plugins: PluginDefinition[] }) {
      try {
        const pluginLoader = new PluginLoader(config.plugins)
        pluginLoader.installGlobalReExports(window)
        const runtimePlugins = await pluginLoader.load()
        self.setPlugins([...corePlugins, ...runtimePlugins])
      } catch (error) {
        self.setError(error)
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
        self.setConfigLoaded(true)
      } catch (error) {
        if (!self.configPath) {
          self.setNoDefaultConfig(true)
          self.setConfigLoaded(true)
        } else {
          self.setError(error)
        }
      }
    },

    async fetchSessionStorageSession() {
      const sessionStr = sessionStorage.getItem('current')

      // check if
      if (sessionStr) {
        const sessionSnap = JSON.parse(sessionStr).session
        if (self.sessionQuery === sessionSnap.id) {
          self.setSessionSnapshot(sessionSnap)
          self.setSessionLoaded(true)
          return
        }
      }
      if (self.bc1) {
        self.bc1.postMessage(self.sessionQuery)
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
        } catch (e) {
          // the broadcast channels did not find the session in another tab
          // clear session param, so just ignore
        }
      }
      self.setSessionLoaded(true)
    },

    async fetchSharedSession() {
      const key = crypto.createHash('sha256').update('JBrowse').digest()
      const decryptedSession = await readSessionFromDynamo(
        self.sessionQuery || '',
        key,
        self.password || '',
      )

      const session = JSON.parse(fromUrlSafeB64(decryptedSession))
      self.setSessionSnapshot({ ...session, id: shortid() })
      self.setSessionLoaded(true)
    },
    async afterCreate() {
      try {
        const { sessionQuery, sharedSession, configPath } = self

        // rename autosave to previousAutosave
        const lastAutosave = localStorage.getItem(`autosave-${configPath}`)
        if (lastAutosave) {
          localStorage.setItem(`previousAutosave-${configPath}`, lastAutosave)
        }

        // fetch config
        await this.fetchConfig()
        if (sharedSession) {
          await this.fetchSharedSession()
        } else if (sessionQuery) {
          await this.fetchSessionStorageSession()
        } else {
          self.setSessionLoaded(true)
        }

        if (self.bc1) {
          self.bc1.onmessage = msg => {
            const ret = JSON.parse(sessionStorage.getItem('current') || '{}')
            if (ret.id === msg.data) {
              if (self.bc2) {
                self.bc2.postMessage(ret)
              }
            }
          }
        }
      } catch (e) {
        self.setError(e)
      }
    },
  }))

export function Loader() {
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

  return <Renderer loader={loader} />
}

const Renderer = observer(
  ({ loader }: { loader: Instance<typeof SessionLoader> }) => {
    const { noDefaultConfig, error, ready } = loader
    const [pluginManager, setPluginManager] = useState<PluginManager>()
    const load = ready && !noDefaultConfig

    // only create the pluginManager/rootModel "on mount"
    useEffect(() => {
      const {
        plugins,
        adminKey,
        sessionQuery,
        configSnapshot,
        sessionSnapshot,
        configPath,
      } = loader
      if (load) {
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
          // in order: saves the previous autosave for recovery, tries to load the local session
          // if session in query, or loads the default session
          if (!sessionQuery || !sessionSnapshot) {
            rootModel.setDefaultSession()
          } else {
            rootModel.setSession(loader.sessionSnapshot)
          }
          // if (!rootModel.session) {
          //   throw new Error('root model did not have any session defined')
          // }

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
        }
      }
    }, [loader, load])

    if (noDefaultConfig) {
      return <NoConfigMessage />
    }
    if (error) {
      throw error
    }

    if (pluginManager) {
      return <JBrowse pluginManager={pluginManager} />
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

function factoryReset() {
  // @ts-ignore
  window.location = window.location.pathname
}
const PlatformSpecificFatalErrorDialog = (props: unknown) => {
  return <FatalErrorDialog onFactoryReset={factoryReset} {...props} />
}
export default () => {
  return (
    <ErrorBoundary FallbackComponent={PlatformSpecificFatalErrorDialog}>
      {/* @ts-ignore*/}
      <QueryParamProvider history={history}>
        <Loader />
      </QueryParamProvider>
    </ErrorBoundary>
  )
}
