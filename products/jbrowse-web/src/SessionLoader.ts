import { types, addDisposer, Instance, SnapshotOut } from 'mobx-state-tree'
import { autorun } from 'mobx'
import PluginLoader, {
  PluginDefinition,
  PluginRecord,
} from '@jbrowse/core/PluginLoader'
import { fromUrlSafeB64 } from './util'
import { readSessionFromDynamo } from './sessionSharing'
import { openLocation } from '@jbrowse/core/util/io'
import { when } from '@jbrowse/core/util'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import JBrowseRootModelFactory from './rootModel'
import shortid from 'shortid'

type Config = SnapshotOut<AnyConfigurationModel>

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
interface PluginsJSON {
  plugins: { url: string }[]
}

async function checkPlugins(pluginsToCheck: { url: string }[]) {
  const res = await fetch('https://jbrowse.org/plugin-store/plugins.json')
  if (!res.ok) {
    const status = await res.text()
    throw new Error(`Failed to fetch plugin data ${status}`)
  }
  const array = (await res.json()) as PluginsJSON
  const allowedPluginUrls = array.plugins.map(p => p.url)
  return pluginsToCheck.every(p => allowedPluginUrls.includes(p.url))
}

const SessionLoader = types
  .model({
    configPath: types.maybe(types.string),
    sessionQuery: types.maybe(types.string),
    password: types.maybe(types.string),
    adminKey: types.maybe(types.string),
    loc: types.maybe(types.string),
    assembly: types.maybe(types.string),
    tracks: types.maybe(types.string),
  })
  .volatile(() => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,
    blankSession: false as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,
    sessionTriaged: undefined as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,
    shareWarningOpen: false as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,
    configSnapshot: undefined as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,
    sessionSnapshot: undefined as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,
    sessionSpec: undefined as any,
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
    get isSharedSession() {
      return !!self.sessionQuery?.startsWith('share-')
    },

    get isSpecSession() {
      return !!self.sessionQuery?.startsWith('spec-')
    },

    get isJb1StyleSession() {
      return !!self.loc
    },

    get isEncodedSession() {
      return !!self.sessionQuery?.startsWith('encoded-')
    },

    get isJsonSession() {
      return !!self.sessionQuery?.startsWith('json-')
    },

    get isLocalSession() {
      return !!self.sessionQuery?.startsWith('local-')
    },

    get ready() {
      return Boolean(this.isSessionLoaded && !self.configError)
    },

    get error() {
      return self.configError || self.sessionError
    },

    get isSessionLoaded() {
      return Boolean(
        self.sessionError ||
          self.sessionSnapshot ||
          self.blankSession ||
          self.sessionSpec,
      )
    },
    get isConfigLoaded() {
      return Boolean(self.configError || self.configSnapshot)
    },
  }))
  .actions(self => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,
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
      reason: { url: string }[]
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

      const data = (await openLocation({
        uri: configPath,
        locationType: 'UriLocation',
      }).readFile('utf8')) as string
      const config = JSON.parse(data)
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

    decodeSessionSpec() {
      if (!self.sessionQuery) {
        return
      }
      self.sessionSpec = JSON.parse(self.sessionQuery.replace('spec-', ''))
    },

    decodeJb1StyleSession() {
      if (self.loc) {
        self.sessionSpec = {
          views: [
            {
              type: 'LGV',
              loc: self.loc,
              tracks: self.tracks?.split(','),
              assembly: self.assembly,
            },
          ],
        }
      }
    },

    async decodeJsonUrlSession() {
      // @ts-ignore
      const session = JSON.parse(self.sessionQuery.replace('json-', ''))
      await this.setSessionSnapshot({ ...session.session, id: shortid() })
    },

    async afterCreate() {
      try {
        // rename autosave to previousAutosave
        const lastAutosave = localStorage.getItem(`autosave-${self.configPath}`)
        if (lastAutosave) {
          localStorage.setItem(
            `previousAutosave-${self.configPath}`,
            lastAutosave,
          )
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
            const {
              isLocalSession,
              isEncodedSession,
              isSpecSession,
              isSharedSession,
              isJsonSession,
              isJb1StyleSession,
              sessionQuery,
              configSnapshot,
            } = self
            if (!configSnapshot) {
              return
            }

            if (isSharedSession) {
              await this.fetchSharedSession()
            } else if (isSpecSession) {
              this.decodeSessionSpec()
            } else if (isJb1StyleSession) {
              this.decodeJb1StyleSession()
            } else if (isEncodedSession) {
              await this.decodeEncodedUrlSession()
            } else if (isJsonSession) {
              await this.decodeJsonUrlSession()
            } else if (isLocalSession) {
              await this.fetchSessionStorageSession()
            } else if (sessionQuery) {
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
          } catch (e) {
            console.error(e)
            self.setSessionError(e)
          }
        }),
      )
    },
  }))

export type SessionLoaderModel = Instance<typeof SessionLoader>

export default SessionLoader

export function loadSessionSpec(
  sessionSpec: {
    views: { type: string; tracks?: string[]; assembly: string; loc: string }[]
  },
  rootModel: Instance<ReturnType<typeof JBrowseRootModelFactory>>,
) {
  const { views } = sessionSpec
  rootModel.setSession({
    name: `New session ${new Date().toLocaleString()}`,
  })
  const { session } = rootModel
  return () =>
    Promise.all(
      views.map(async view => {
        const { tracks, type, assembly, loc } = view
        if (type === 'LGV' || type === 'LinearGenomeView') {
          const materialView = session?.addView('LinearGenomeView', {})
          await when(() => materialView.volatileWidth !== undefined)
          await rootModel.assemblyManager.waitForAssembly(assembly)
          materialView.navToLocString(loc, assembly)
          tracks?.forEach(track => {
            materialView.showTrack(track)
          })
        }
      }),
    )
}
