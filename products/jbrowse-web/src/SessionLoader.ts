import { types, addDisposer, Instance } from 'mobx-state-tree'
import { autorun } from 'mobx'
import PluginLoader, {
  PluginDefinition,
  PluginRecord,
} from '@jbrowse/core/PluginLoader'
import PluginManager from '@jbrowse/core/PluginManager'
import { openLocation } from '@jbrowse/core/util/io'
import { nanoid } from '@jbrowse/core/util/nanoid'

// locals
import { readSessionFromDynamo } from './sessionSharing'
import { addRelativeUris, checkPlugins, fromUrlSafeB64, readConf } from './util'

export interface SessionTriagedInfo {
  snap: unknown
  origin: string
  reason: PluginDefinition[]
}

const SessionLoader = types
  .model({
    adminKey: types.maybe(types.string),
    assembly: types.maybe(types.string),
    configPath: types.maybe(types.string),
    highlight: types.maybe(types.string),
    initialTimestamp: types.number,
    loc: types.maybe(types.string),
    nav: types.maybe(types.boolean),
    password: types.maybe(types.string),
    sessionQuery: types.maybe(types.string),
    sessionTracks: types.maybe(types.string),
    tracklist: types.maybe(types.boolean),
    tracks: types.maybe(types.string),
  })
  .volatile(() => ({
    bc1:
      window.BroadcastChannel &&
      new window.BroadcastChannel('jb_request_session'),
    bc2:
      window.BroadcastChannel &&
      new window.BroadcastChannel('jb_respond_session'),
    blankSession: false,
    configError: undefined as unknown,
    configSnapshot: undefined as Record<string, unknown> | undefined,
    runtimePlugins: [] as PluginRecord[],
    sessionError: undefined as unknown,
    sessionPlugins: [] as PluginRecord[],
    sessionSnapshot: undefined as Record<string, unknown> | undefined,
    sessionSpec: undefined as Record<string, unknown> | undefined,
    sessionTriaged: undefined as SessionTriagedInfo | undefined,
  }))
  .views(self => ({
    get error() {
      return self.configError || self.sessionError
    },

    get isConfigLoaded() {
      return Boolean(self.configError || self.configSnapshot)
    },

    get isEncodedSession() {
      return !!self.sessionQuery?.startsWith('encoded-')
    },

    get isJb1StyleSession() {
      return !!self.loc
    },

    get isJsonSession() {
      return !!self.sessionQuery?.startsWith('json-')
    },

    get isLocalSession() {
      return !!self.sessionQuery?.startsWith('local-')
    },

    get isSessionLoaded() {
      return Boolean(
        self.sessionError ||
          self.sessionSnapshot ||
          self.blankSession ||
          self.sessionSpec,
      )
    },

    get isSharedSession() {
      return !!self.sessionQuery?.startsWith('share-')
    },

    get isSpecSession() {
      return !!self.sessionQuery?.startsWith('spec-')
    },
    get ready() {
      return Boolean(this.isSessionLoaded && !self.configError)
    },

    get sessionTracksParsed() {
      return self.sessionTracks ? JSON.parse(self.sessionTracks) : []
    },
  }))
  .actions(self => ({
    setBlankSession(flag: boolean) {
      self.blankSession = flag
    },

    setConfigError(error: unknown) {
      self.configError = error
    },

    setConfigSnapshot(snap: Record<string, unknown>) {
      self.configSnapshot = snap
    },

    setRuntimePlugins(plugins: PluginRecord[]) {
      self.runtimePlugins = plugins
    },

    setSessionError(error: unknown) {
      self.sessionError = error
    },

    setSessionPlugins(plugins: PluginRecord[]) {
      self.sessionPlugins = plugins
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any,
    setSessionQuery(session?: any) {
      self.sessionQuery = session
    },
    setSessionSnapshotSuccess(snap: Record<string, unknown>) {
      self.sessionSnapshot = snap
    },
    setSessionTriaged(args?: SessionTriagedInfo) {
      self.sessionTriaged = args
    },
  }))
  .actions(self => ({
    async afterCreate() {
      try {
        // rename the current autosave from previously loaded jbrowse session
        // into previousAutosave on load
        const { configPath } = self
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

            if (self.bc1) {
              self.bc1.onmessage = msg => {
                const r =
                  JSON.parse(sessionStorage.getItem('current') || '{}')
                    .session || {}
                if (r.id === msg.data && self.bc2) {
                  self.bc2.postMessage(r)
                }
              }
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
          } catch (e) {
            console.error(e)
            self.setSessionError(e)
          }
        }),
      )
    },
    async decodeEncodedUrlSession() {
      const session = JSON.parse(
        // @ts-expect-error
        await fromUrlSafeB64(self.sessionQuery.replace('encoded-', '')),
      )
      await this.setSessionSnapshot({ ...session, id: nanoid() })
    },

    decodeJb1StyleSession() {
      const {
        loc,
        tracks,
        assembly,
        tracklist,
        nav,
        highlight,
        sessionTracksParsed: sessionTracks,
      } = self
      if (loc) {
        self.sessionSpec = {
          sessionTracks,
          views: [
            {
              assembly,
              highlight,
              loc,
              nav,
              sessionTracks,
              tracklist,
              tracks: tracks?.split(','),
              type: 'LinearGenomeView',
            },
          ],
        }
      }
    },

    async decodeJsonUrlSession() {
      // @ts-expect-error
      const session = JSON.parse(self.sessionQuery.replace('json-', ''))
      await this.setSessionSnapshot({ ...session.session, id: nanoid() })
    },

    decodeSessionSpec() {
      if (!self.sessionQuery) {
        return
      }
      self.sessionSpec = JSON.parse(self.sessionQuery.replace('spec-', ''))
    },

    async fetchConfig() {
      // @ts-expect-error
      // eslint-disable-next-line no-underscore-dangle
      let { configPath = window.__jbrowseConfigPath || 'config.json' } = self

      // @ts-expect-error
      // eslint-disable-next-line no-underscore-dangle
      if (window.__jbrowseCacheBuster) {
        configPath += `?rand=${Math.random()}`
      }

      const text = await openLocation({
        locationType: 'UriLocation',
        uri: configPath,
      }).readFile('utf8')
      const config = JSON.parse(text)
      const configUri = new URL(configPath, window.location.href)
      addRelativeUris(config, configUri)

      // cross origin config check
      if (configUri.hostname !== window.location.hostname) {
        const configPlugins = config.plugins || []
        const configPluginsAllowed = await checkPlugins(configPlugins)
        if (!configPluginsAllowed) {
          return self.setSessionTriaged({
            origin: 'config',
            reason: configPlugins,
            snap: config,
          })
        }
      }
      await this.fetchPlugins(config)
      self.setConfigSnapshot(config)
    },

    async fetchPlugins(config: { plugins: PluginDefinition[] }) {
      try {
        const pluginLoader = new PluginLoader(config.plugins, {
          fetchESM: url => import(/* webpackIgnore:true */ url),
        })
        pluginLoader.installGlobalReExports(window)
        const runtimePlugins = await pluginLoader.load(window.location.href)
        self.setRuntimePlugins([...runtimePlugins])
      } catch (e) {
        console.error(e)
        self.setConfigError(e)
      }
    },

    async fetchSessionPlugins(snap: { sessionPlugins?: PluginDefinition[] }) {
      try {
        const pluginLoader = new PluginLoader(snap.sessionPlugins || [], {
          fetchESM: url => import(/* webpackIgnore:true */ url),
        })
        pluginLoader.installGlobalReExports(window)
        const plugins = await pluginLoader.load(window.location.href)
        self.setSessionPlugins([...plugins])
      } catch (e) {
        console.error(e)
        self.setConfigError(e)
      }
    },

    async fetchSessionStorageSession() {
      const sessionStr = sessionStorage.getItem('current')
      const query = self.sessionQuery!.replace('local-', '')

      // check if
      if (sessionStr) {
        const sessionSnap = JSON.parse(sessionStr).session || {}
        if (query === sessionSnap.id) {
          return this.setSessionSnapshot(sessionSnap)
        }
      }

      if (self.bc1) {
        self.bc1.postMessage(query)
        try {
          const result = await new Promise<Record<string, unknown>>(
            (resolve, reject) => {
              if (self.bc2) {
                self.bc2.onmessage = msg => {
                  resolve(msg.data)
                }
              }
              setTimeout(() => reject(), 1000)
            },
          )
          return this.setSessionSnapshot({ ...result, id: nanoid() })
        } catch (e) {
          // the broadcast channels did not find the session in another tab
          // clear session param, so just ignore
        }
      }
      throw new Error('Local storage session not found')
    },

    async fetchSharedSession() {
      const defaultURL = 'https://share.jbrowse.org/api/v1/'
      const decryptedSession = await readSessionFromDynamo(
        // @ts-expect-error
        `${readConf(self.configSnapshot, 'shareURL', defaultURL)}load`,
        self.sessionQuery || '',
        self.password || '',
      )

      const session = JSON.parse(await fromUrlSafeB64(decryptedSession))
      await this.setSessionSnapshot({ ...session, id: nanoid() })
    },

    // passed
    async setSessionSnapshot(
      snap: { sessionPlugins?: PluginDefinition[]; id: string },
      userAcceptedConfirmation?: boolean,
    ) {
      try {
        const { sessionPlugins = [] } = snap
        const sessionPluginsAllowed = await checkPlugins(sessionPlugins)
        if (sessionPluginsAllowed || userAcceptedConfirmation) {
          await this.fetchSessionPlugins(snap)
          self.setSessionSnapshotSuccess(snap)
        } else {
          self.setSessionTriaged({
            origin: 'session',
            reason: sessionPlugins,
            snap,
          })
        }
      } catch (e) {
        console.error(e)
        self.setConfigError(e)
      }
    },
  }))

export type SessionLoaderModel = Instance<typeof SessionLoader>

export default SessionLoader

interface ViewSpec {
  type: string
  tracks?: string[]
  assembly: string
  loc: string
}

// use extension point named e.g. LaunchView-LinearGenomeView to initialize an
// LGV session
export function loadSessionSpec(
  {
    views,
    sessionTracks = [],
  }: {
    views: ViewSpec[]
    sessionTracks: unknown[]
  },
  pluginManager: PluginManager,
) {
  return async () => {
    const { rootModel } = pluginManager
    if (!rootModel) {
      throw new Error('rootModel not initialized')
    }
    try {
      // @ts-expect-error
      rootModel.setSession({
        name: `New session ${new Date().toLocaleString()}`,
      })

      // @ts-expect-error
      sessionTracks.forEach(track => rootModel.session.addTrackConf(track))

      await Promise.all(
        views.map(view =>
          pluginManager.evaluateAsyncExtensionPoint('LaunchView-' + view.type, {
            ...view,
            session: rootModel.session,
          }),
        ),
      )
    } catch (e) {
      console.error(e)
      rootModel.session?.notify(`${e}`)
    }
  }
}
