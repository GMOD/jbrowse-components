import PluginLoader from '@jbrowse/core/PluginLoader'
import { openLocation } from '@jbrowse/core/util/io'
import { nanoid } from '@jbrowse/core/util/nanoid'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { openDB } from 'idb'
import { autorun } from 'mobx'

import { readSessionFromDynamo } from './sessionSharing'
import { addRelativeUris, checkPlugins, fromUrlSafeB64, readConf } from './util'

import type { SessionDB, SessionTriagedInfo } from './types'
import type { PluginDefinition, PluginRecord } from '@jbrowse/core/PluginLoader'
import type { Instance } from '@jbrowse/mobx-state-tree'

const SessionLoader = types
  .model({
    /**
     * #property
     */
    configPath: types.maybe(types.string),
    /**
     * #property
     */
    sessionQuery: types.maybe(types.string),
    /**
     * #property
     */
    password: types.maybe(types.string),
    /**
     * #property
     */
    adminKey: types.maybe(types.string),
    /**
     * #property
     */
    loc: types.maybe(types.string),
    /**
     * #property
     */
    sessionTracks: types.maybe(types.string),
    /**
     * #property
     */
    assembly: types.maybe(types.string),
    /**
     * #property
     */
    tracks: types.maybe(types.string),
    /**
     * #property
     */
    tracklist: types.maybe(types.boolean),
    /**
     * #property
     */
    highlight: types.maybe(types.string),
    /**
     * #property
     */
    nav: types.maybe(types.boolean),
    /**
     * #property
     */
    initialTimestamp: types.number,

    /**
     * #property
     */
    hubURL: types.maybe(types.array(types.string)),
    /**
     * #property
     */
    configSnapshot: types.frozen<Record<string, unknown> | undefined>(
      undefined,
    ),
    /**
     * #property
     */
    sessionSnapshot: types.frozen<Record<string, unknown> | undefined>(
      undefined,
    ),
  })
  .volatile(() => ({
    /**
     * #volatile
     */
    sessionTriaged: undefined as SessionTriagedInfo | undefined,
    /**
     * #volatile
     */
    sessionSpec: undefined as Record<string, unknown> | undefined,
    /**
     * #volatile
     */
    hubSpec: undefined as Record<string, unknown> | undefined,
    /**
     * #volatile
     */
    blankSession: false,
    /**
     * #volatile
     */
    runtimePlugins: undefined as PluginRecord[] | undefined,
    /**
     * #volatile
     */
    sessionPlugins: undefined as PluginRecord[] | undefined,
    /**
     * #volatile
     */
    sessionError: undefined as unknown,
    /**
     * #volatile
     */
    configError: undefined as unknown,
    /**
     * #volatile
     */
    bc1:
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      window.BroadcastChannel
        ? new window.BroadcastChannel('jb_request_session')
        : undefined,
    /**
     * #volatile
     */
    bc2:
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      window.BroadcastChannel
        ? new window.BroadcastChannel('jb_respond_session')
        : undefined,
  }))
  .views(self => ({
    /**
     * #getter
     */
    get isSharedSession() {
      return !!self.sessionQuery?.startsWith('share-')
    },
    /**
     * #getter
     */
    get isSpecSession() {
      return !!self.sessionQuery?.startsWith('spec-')
    },
    /**
     * #getter
     */
    get isHubSession() {
      return !!self.hubURL
    },
    /**
     * #getter
     */
    get isJb1StyleSession() {
      return !!(self.loc || self.assembly)
    },

    /**
     * #getter
     */
    get isEncodedSession() {
      return !!self.sessionQuery?.startsWith('encoded-')
    },
    /**
     * #getter
     */
    get isJsonSession() {
      return !!self.sessionQuery?.startsWith('json-')
    },
    /**
     * #getter
     */
    get isLocalSession() {
      return !!self.sessionQuery?.startsWith('local-')
    },
    /**
     * #getter
     */
    get ready(): boolean {
      return this.isSessionLoaded && !self.configError && this.pluginsLoaded
    },
    /**
     * #getter
     */
    get error() {
      return self.configError || self.sessionError
    },
    /**
     * #getter
     */
    get pluginsLoaded() {
      if (self.sessionError || self.blankSession || self.sessionSpec) {
        // don't need session plugins for these cases
        return Boolean(self.runtimePlugins)
      }
      return Boolean(self.runtimePlugins && self.sessionPlugins)
    },
    /**
     * #getter
     */
    get isSessionLoaded() {
      return Boolean(
        self.sessionError ||
        self.sessionSnapshot ||
        self.blankSession ||
        self.sessionSpec,
      )
    },
    /**
     * #getter
     */
    get isConfigLoaded() {
      return Boolean(self.configError || self.configSnapshot)
    },
    /**
     * #getter
     */
    get sessionTracksParsed() {
      return self.sessionTracks ? JSON.parse(self.sessionTracks) : []
    },
  }))
  .actions(self => ({
    /**
     * #action
     */
    setSessionQuery(session?: any) {
      console.log('[SessionLoader] setSessionQuery:', session)
      self.sessionQuery = session
    },
    /**
     * #action
     */
    setConfigError(error: unknown) {
      console.log('[SessionLoader] setConfigError:', error)
      self.configError = error
    },
    /**
     * #action
     */
    setSessionError(error: unknown) {
      console.log('[SessionLoader] setSessionError:', error)
      self.sessionError = error
    },
    /**
     * #action
     */
    setRuntimePlugins(plugins: PluginRecord[]) {
      console.log('[SessionLoader] setRuntimePlugins:', plugins.length, 'plugins')
      self.runtimePlugins = plugins
    },
    /**
     * #action
     */
    setSessionPlugins(plugins: PluginRecord[]) {
      console.log('[SessionLoader] setSessionPlugins:', plugins.length, 'plugins')
      self.sessionPlugins = plugins
    },
    /**
     * #action
     */
    setConfigSnapshot(snap: Record<string, unknown>) {
      console.log('[SessionLoader] setConfigSnapshot - assemblies:', (snap as any).assemblies?.length)
      self.configSnapshot = snap
    },
    /**
     * #action
     */
    setBlankSession(flag: boolean) {
      console.log('[SessionLoader] setBlankSession:', flag)
      self.blankSession = flag
    },
    /**
     * #action
     */
    setSessionTriaged(args?: SessionTriagedInfo) {
      console.log('[SessionLoader] setSessionTriaged:', args?.origin)
      self.sessionTriaged = args
    },
    /**
     * #action
     */
    setSessionSnapshot(snap: Record<string, unknown>) {
      console.log('[SessionLoader] setSessionSnapshot - id:', (snap as any).id)
      self.sessionSnapshot = snap
    },
  }))
  .actions(self => ({
    /**
     * #action
     */
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
    /**
     * #action
     */
    async fetchSessionPlugins(snap: { sessionPlugins?: PluginDefinition[] }) {
      try {
        const pluginLoader = new PluginLoader(snap.sessionPlugins || [], {
          fetchESM: url => import(/* webpackIgnore:true */ url),
        }).installGlobalReExports(window)
        const plugins = await pluginLoader.load(window.location.href)
        self.setSessionPlugins([...plugins])
      } catch (e) {
        console.error(e)
        self.setConfigError(e)
      }
    },

    /**
     * #action
     */
    async loadSession(
      snap: { sessionPlugins?: PluginDefinition[]; id: string },
      userAcceptedConfirmation?: boolean,
    ) {
      console.log('[SessionLoader] loadSession called, snap.id:', snap.id)
      console.log('[SessionLoader] loadSession snap keys:', Object.keys(snap))
      console.log('[SessionLoader] loadSession userAcceptedConfirmation:', userAcceptedConfirmation)
      try {
        const { sessionPlugins = [] } = snap
        console.log('[SessionLoader] loadSession sessionPlugins:', sessionPlugins.length)
        const sessionPluginsAllowed = await checkPlugins(sessionPlugins)
        console.log('[SessionLoader] loadSession sessionPluginsAllowed:', sessionPluginsAllowed)
        if (sessionPluginsAllowed || userAcceptedConfirmation) {
          console.log('[SessionLoader] loadSession - fetching session plugins')
          await this.fetchSessionPlugins(snap)
          console.log('[SessionLoader] loadSession - setting session snapshot')
          self.setSessionSnapshot(snap)
        } else {
          console.log('[SessionLoader] loadSession - triaging session due to plugins')
          self.setSessionTriaged({
            snap,
            origin: 'session',
            reason: sessionPlugins,
          })
        }
      } catch (e) {
        console.error('[SessionLoader] loadSession error:', e)
        self.setConfigError(e)
      }
    },
    /**
     * #action
     */
    async fetchConfig() {
      console.log('[SessionLoader] fetchConfig called')
      // @ts-expect-error
      const path = window.__jbrowseConfigPath
      const { configPath = path || 'config.json' } = self
      const shouldFetchConfig = configPath !== 'none'
      console.log('[SessionLoader] fetchConfig - configPath:', configPath, 'shouldFetchConfig:', shouldFetchConfig)

      // if ?config=none then we will not load the config, which is useful for
      // ?hubURL which may not need a config
      //
      // however, in the rare case that you want hubs and a config (e.g. your
      // config has plugins to load) then you can still have this too
      if (shouldFetchConfig) {
        console.log('[SessionLoader] Fetching config from:', configPath)
        const text = await openLocation({
          uri:
            configPath +
            // @ts-expect-error
            (window.__jbrowseCacheBuster ? `?rand=${Math.random()}` : ''),
          locationType: 'UriLocation',
        }).readFile('utf8')
        const config = JSON.parse(text)
        console.log('[SessionLoader] Config fetched, assemblies:', config.assemblies?.length)
        const configUri = new URL(configPath, window.location.href)
        addRelativeUris(config, configUri)

        // cross origin config check
        if (configUri.hostname !== window.location.hostname) {
          console.log('[SessionLoader] Cross-origin config detected')
          const configPlugins = config.plugins || []
          const configPluginsAllowed = await checkPlugins(configPlugins)
          if (!configPluginsAllowed) {
            console.log('[SessionLoader] Config plugins not allowed, triaging session')
            self.setSessionTriaged({
              snap: config,
              origin: 'config',
              reason: configPlugins,
            })
            return
          }
        }
        console.log('[SessionLoader] Fetching plugins')
        await this.fetchPlugins(config)
        console.log('[SessionLoader] Setting config snapshot')
        self.setConfigSnapshot(config)
      } else {
        console.log('[SessionLoader] Setting empty config snapshot (config=none)')
        self.setConfigSnapshot({})
      }
    },
    /**
     * action
     */
    async setUpConfig() {
      console.log('[SessionLoader] setUpConfig called (existing configSnapshot)')
      // @ts-expect-error
      const path = window.__jbrowseConfigPath
      const { configPath = path || 'config.json' } = self
      const configUri = new URL(configPath, window.location.href)
      const { configSnapshot } = self
      console.log('[SessionLoader] setUpConfig - configPath:', configPath)
      console.log('[SessionLoader] setUpConfig - configSnapshot exists:', !!configSnapshot)
      const config = JSON.parse(JSON.stringify(configSnapshot))
      addRelativeUris(config, configUri)
      console.log('[SessionLoader] setUpConfig - setting config snapshot')
      self.setConfigSnapshot(config)
      console.log('[SessionLoader] setUpConfig - fetching plugins')
      await this.fetchPlugins(config)
      console.log('[SessionLoader] setUpConfig - complete')
    },
    /**
     * #action
     */
    async fetchSessionStorageSession() {
      console.log('[SessionLoader] fetchSessionStorageSession called')
      const sessionStr = sessionStorage.getItem('current')
      const query = self.sessionQuery!.replace('local-', '')
      console.log('[SessionLoader] sessionStorage current:', sessionStr?.slice(0, 200))
      console.log('[SessionLoader] query (local session id):', query)

      if (sessionStr) {
        const sessionSnap = JSON.parse(sessionStr).session || {}
        console.log('[SessionLoader] parsed sessionSnap.id:', sessionSnap.id)
        if (query === sessionSnap.id) {
          console.log('[SessionLoader] Session ID matches, loading session from sessionStorage')
          return this.loadSession(sessionSnap)
        }
        console.log('[SessionLoader] Session ID mismatch - query:', query, 'sessionSnap.id:', sessionSnap.id)
      }

      // check IndexedDB for saved session
      console.log('[SessionLoader] Checking IndexedDB for saved session')
      try {
        const sessionDB = await openDB<SessionDB>('sessionsDB', 2, {
          upgrade(db) {
            db.createObjectStore('metadata')
            db.createObjectStore('sessions')
          },
        })
        const sessionSnap = await sessionDB.get('sessions', query)
        console.log('[SessionLoader] IndexedDB session found:', !!sessionSnap)
        if (sessionSnap) {
          await this.loadSession(sessionSnap)
        }
      } catch (e) {
        console.error('[SessionLoader] IndexedDB error:', e)
      }

      if (self.bc1) {
        console.log('[SessionLoader] Trying BroadcastChannel to find session in other tabs')
        self.bc1.postMessage(query)
        try {
          const result = await new Promise<Record<string, unknown>>(
            (resolve, reject) => {
              if (self.bc2) {
                self.bc2.onmessage = msg => {
                  console.log('[SessionLoader] BroadcastChannel received session from another tab')
                  resolve(msg.data)
                }
              }
              setTimeout(() => {
                reject(new Error('timeout'))
              }, 1000)
            },
          )
          console.log('[SessionLoader] Loading session from BroadcastChannel')
          await this.loadSession({ ...result, id: nanoid() })
        } catch (e) {
          console.log('[SessionLoader] BroadcastChannel timeout - no session found in other tabs')
          // the broadcast channels did not find the session in another tab
          // clear session param, so just ignore
        }
      }
      throw new Error('Local storage session not found')
    },
    /**
     * #action
     */
    async checkExistingSession(sessionSnapshot: Record<string, unknown>) {
      console.log('[SessionLoader] checkExistingSession called')
      console.log('[SessionLoader] checkExistingSession - sessionPlugins exist:', !!self.sessionPlugins)
      console.log('[SessionLoader] checkExistingSession - sessionSnapshot id:', sessionSnapshot.id)
      if (!self.sessionPlugins) {
        console.log('[SessionLoader] checkExistingSession - loading session (plugins not loaded yet)')
        // session snapshot probably provided during .create() but plugins
        // haven't been loaded yet
        // @ts-expect-error
        await this.loadSession(sessionSnapshot)
      } else {
        console.log('[SessionLoader] checkExistingSession - session plugins already loaded, skipping')
      }
    },
    /**
     * #action
     */
    async fetchSharedSession() {
      const defaultURL = 'https://share.jbrowse.org/api/v1/'
      const decryptedSession = await readSessionFromDynamo(
        // @ts-expect-error
        `${readConf(self.configSnapshot, 'shareURL', defaultURL)}load`,
        self.sessionQuery || '',
        self.password || '',
      )

      const session = JSON.parse(await fromUrlSafeB64(decryptedSession))
      await this.loadSession({
        ...session,
        id: nanoid(),
      })
    },
    /**
     * #action
     */
    async decodeEncodedUrlSession() {
      const session = JSON.parse(
        // @ts-expect-error
        await fromUrlSafeB64(self.sessionQuery.replace('encoded-', '')),
      )
      await this.loadSession({
        ...session,
        id: nanoid(),
      })
    },
    /**
     * #action
     */
    decodeSessionSpec() {
      if (!self.sessionQuery) {
        return
      }
      self.sessionSpec = JSON.parse(self.sessionQuery.replace('spec-', ''))
    },
    /**
     * #action
     */
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
      if (loc || assembly) {
        self.sessionSpec = {
          sessionTracks,
          views: [
            {
              type: 'LinearGenomeView',
              tracks: tracks?.split(','),
              sessionTracks,
              loc,
              assembly,
              tracklist,
              nav,
              highlight: highlight?.split(' '),
            },
          ],
        }
      }
    },

    /**
     * #action
     */
    decodeHubSpec() {
      const { hubURL, sessionTracksParsed: sessionTracks } = self

      self.hubSpec = {
        sessionTracks,
        hubURL,
      }
    },
    /**
     * #action
     */
    async decodeJsonUrlSession() {
      // @ts-expect-error
      const { session } = JSON.parse(self.sessionQuery.replace(/^json-/, ''))
      await this.loadSession({
        ...session,
        id: nanoid(),
      })
    },
    /**
     * #aftercreate
     */
    afterCreate() {
      console.log('[SessionLoader] afterCreate called')
      console.log('[SessionLoader] Initial state - sessionQuery:', self.sessionQuery)
      console.log('[SessionLoader] Initial state - configSnapshot:', !!self.configSnapshot)
      console.log('[SessionLoader] Initial state - sessionSnapshot:', !!self.sessionSnapshot)
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      ;(async () => {
        try {
          console.log('[SessionLoader] Starting config setup, configSnapshot exists:', !!self.configSnapshot)
          await (self.configSnapshot ? this.setUpConfig() : this.fetchConfig())
          console.log('[SessionLoader] Config setup complete')

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
                  isHubSession,
                  sessionQuery,
                  sessionSnapshot,
                  configSnapshot,
                } = self
                console.log('[SessionLoader] autorun triggered')
                console.log('[SessionLoader] Session type flags:', {
                  isLocalSession,
                  isEncodedSession,
                  isSpecSession,
                  isSharedSession,
                  isJsonSession,
                  isJb1StyleSession,
                  isHubSession,
                })
                console.log('[SessionLoader] sessionQuery:', sessionQuery)
                console.log('[SessionLoader] configSnapshot exists:', !!configSnapshot)
                console.log('[SessionLoader] sessionSnapshot exists:', !!sessionSnapshot)
                if (!configSnapshot) {
                  console.log('[SessionLoader] No configSnapshot yet, returning early')
                  return
                }

                if (self.bc1) {
                  self.bc1.onmessage = msg => {
                    console.log('[SessionLoader] bc1 received message:', msg.data)
                    const r =
                      JSON.parse(sessionStorage.getItem('current') || '{}')
                        .session || {}
                    console.log('[SessionLoader] bc1 checking session id match:', r.id, '===', msg.data)
                    if (r.id === msg.data && self.bc2) {
                      console.log('[SessionLoader] bc1 responding with session')
                      self.bc2.postMessage(r)
                    }
                  }
                }
                if (sessionSnapshot) {
                  console.log('[SessionLoader] Using existing sessionSnapshot')
                  await this.checkExistingSession(sessionSnapshot)
                } else if (isSharedSession) {
                  console.log('[SessionLoader] Loading shared session')
                  await this.fetchSharedSession()
                } else if (isSpecSession) {
                  console.log('[SessionLoader] Decoding spec session')
                  this.decodeSessionSpec()
                } else if (isJb1StyleSession) {
                  console.log('[SessionLoader] Decoding JB1 style session')
                  this.decodeJb1StyleSession()
                } else if (isEncodedSession) {
                  console.log('[SessionLoader] Decoding encoded URL session')
                  await this.decodeEncodedUrlSession()
                } else if (isJsonSession) {
                  console.log('[SessionLoader] Decoding JSON URL session')
                  await this.decodeJsonUrlSession()
                } else if (isLocalSession) {
                  console.log('[SessionLoader] Loading local session from sessionStorage')
                  await this.fetchSessionStorageSession()
                } else if (isHubSession) {
                  console.log('[SessionLoader] Decoding hub spec session')
                  // this is later in the list: prioritiz local session of "hub
                  // spec" since hub is left in URL even when there may be a
                  // local session
                  this.decodeHubSpec()
                  self.setBlankSession(true)
                } else if (sessionQuery) {
                  console.log('[SessionLoader] Unrecognized session format:', sessionQuery)
                  // if there was a sessionQuery and we don't recognize it
                  throw new Error('unrecognized session format')
                } else {
                  console.log('[SessionLoader] No session query, setting blank session')
                  // placeholder for session loaded, but none found
                  self.setBlankSession(true)
                }
              } catch (e) {
                console.error('[SessionLoader] autorun error:', e)
                self.setSessionError(e)
              }
            }),
          )
        } catch (e) {
          console.error('[SessionLoader] afterCreate error:', e)
          self.setConfigError(e)
        }
      })()
    },
  }))

export type SessionLoaderModel = Instance<typeof SessionLoader>

export default SessionLoader
