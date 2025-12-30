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
     * Warning message to display after session loads (for non-fatal issues)
     */
    sessionWarning: undefined as string | undefined,
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
    /**
     * #getter
     */
    get resolvedConfigPath() {
      // @ts-expect-error
      const path = window.__jbrowseConfigPath as string | undefined
      return self.configPath || path || 'config.json'
    },
  }))
  .actions(self => ({
    /**
     * #action
     */
    setConfigError(error: unknown) {
      self.configError = error
    },
    /**
     * #action
     */
    setSessionError(error: unknown) {
      self.sessionError = error
    },
    /**
     * #action
     */
    setRuntimePlugins(plugins: PluginRecord[]) {
      self.runtimePlugins = plugins
    },
    /**
     * #action
     */
    setSessionPlugins(plugins: PluginRecord[]) {
      self.sessionPlugins = plugins
    },
    /**
     * #action
     */
    setConfigSnapshot(snap: Record<string, unknown>) {
      self.configSnapshot = snap
    },
    /**
     * #action
     */
    setBlankSession(flag: boolean) {
      self.blankSession = flag
    },
    /**
     * #action
     */
    setSessionTriaged(args?: SessionTriagedInfo) {
      self.sessionTriaged = args
    },
    /**
     * #action
     */
    setSessionSnapshot(snap: Record<string, unknown>) {
      self.sessionSnapshot = snap
    },
    /**
     * #action
     */
    setSessionWarning(warning: string | undefined) {
      self.sessionWarning = warning
    },
  }))
  .actions(self => ({
    /**
     * #action
     */
    async fetchPlugins(config: { plugins?: PluginDefinition[] }) {
      try {
        const pluginLoader = new PluginLoader(config.plugins || [], {
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
      try {
        const { sessionPlugins = [] } = snap
        const sessionPluginsAllowed = await checkPlugins(sessionPlugins)
        if (sessionPluginsAllowed || userAcceptedConfirmation) {
          await this.fetchSessionPlugins(snap)
          self.setSessionSnapshot(snap)
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
    /**
     * #action
     */
    async fetchConfig() {
      const configPath = self.resolvedConfigPath
      const shouldFetchConfig = configPath !== 'none'

      // if ?config=none then we will not load the config, which is useful for
      // ?hubURL which may not need a config
      //
      // however, in the rare case that you want hubs and a config (e.g. your
      // config has plugins to load) then you can still have this too
      if (shouldFetchConfig) {
        const text = await openLocation({
          uri:
            configPath +
            // @ts-expect-error
            (window.__jbrowseCacheBuster ? `?rand=${Math.random()}` : ''),
          locationType: 'UriLocation',
        }).readFile('utf8')
        const config = JSON.parse(text)
        const configUri = new URL(configPath, window.location.href)
        addRelativeUris(config, configUri)

        // cross origin config check
        if (configUri.hostname !== window.location.hostname) {
          const configPlugins = config.plugins || []
          const configPluginsAllowed = await checkPlugins(configPlugins)
          if (!configPluginsAllowed) {
            self.setSessionTriaged({
              snap: config,
              origin: 'config',
              reason: configPlugins,
            })
            return
          }
        }
        await this.fetchPlugins(config)
        self.setConfigSnapshot(config)
      } else {
        self.setConfigSnapshot({})
      }
    },
    /**
     * #action
     * Called when configSnapshot already exists (e.g., from HMR or plugin reload)
     */
    async setUpConfig() {
      const configPath = self.resolvedConfigPath
      const configUri = new URL(configPath, window.location.href)
      // configSnapshot is guaranteed to exist when this method is called
      const config = structuredClone(self.configSnapshot) as Record<
        string,
        unknown
      >
      addRelativeUris(config, configUri)
      self.setConfigSnapshot(config)
      await this.fetchPlugins(config)
    },
    /**
     * #action
     */
    async fetchSessionFromSessionStorage(query: string) {
      const sessionStr = sessionStorage.getItem('current')
      if (sessionStr) {
        const sessionSnap = JSON.parse(sessionStr).session || {}
        if (query === sessionSnap.id) {
          // Assign new ID to avoid conflicts when same session is opened in
          // multiple tabs (each tab gets its own copy with unique ID)
          await this.loadDecodedSession(sessionSnap)
          return true
        }
      }
      return false
    },
    /**
     * #action
     */
    async fetchSessionFromIndexedDB(query: string) {
      try {
        const sessionDB = await openDB<SessionDB>('sessionsDB', 2, {
          upgrade(db) {
            db.createObjectStore('metadata')
            db.createObjectStore('sessions')
          },
        })
        const sessionSnap = await sessionDB.get('sessions', query)
        if (sessionSnap) {
          // Assign new ID to avoid conflicts when same session is opened in
          // multiple tabs (each tab gets its own copy with unique ID)
          await this.loadDecodedSession(sessionSnap)
          return true
        }
      } catch (e) {
        console.error(e)
      }
      return false
    },
    /**
     * #action
     * Tries to load a local session from multiple sources in order:
     * 1. sessionStorage (current session)
     * 2. IndexedDB (autosaved sessions)
     */
    async fetchLocalSession() {
      const query = self.sessionQuery!.replace('local-', '')

      if (await this.fetchSessionFromSessionStorage(query)) {
        return
      }
      if (await this.fetchSessionFromIndexedDB(query)) {
        return
      }
      throw new Error('Local session not found')
    },
    /**
     * #action
     * When sessionSnapshot is provided during .create() (e.g., from HMR or
     * plugin reload), plugins haven't been loaded yet. This loads them.
     */
    async loadSessionPluginsIfNeeded(sessionSnapshot: Record<string, unknown>) {
      if (!self.sessionPlugins) {
        // @ts-expect-error
        await this.loadSession(sessionSnapshot)
      }
    },
    /**
     * #action
     * Helper to load a decoded session with a fresh ID
     */
    async loadDecodedSession(session: Record<string, unknown>) {
      await this.loadSession({
        ...session,
        id: nanoid(),
      })
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
      await this.loadDecodedSession(session)
    },
    /**
     * #action
     */
    async decodeEncodedUrlSession() {
      // sessionQuery is guaranteed to exist when isEncodedSession is true
      const session = JSON.parse(
        await fromUrlSafeB64(self.sessionQuery!.replace('encoded-', '')),
      )
      await this.loadDecodedSession(session)
    },
    /**
     * #action
     */
    decodeSessionSpec() {
      // sessionQuery is guaranteed to exist when isSpecSession is true
      self.sessionSpec = JSON.parse(self.sessionQuery!.replace('spec-', ''))
    },
    /**
     * #action
     * Called when isJb1StyleSession is true (loc or assembly exists)
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
      // sessionQuery is guaranteed to exist when isJsonSession is true
      const { session } = JSON.parse(self.sessionQuery!.replace(/^json-/, ''))
      await this.loadDecodedSession(session)
    },
    /**
     * #aftercreate
     */
    afterCreate() {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      ;(async () => {
        try {
          await (self.configSnapshot ? this.setUpConfig() : this.fetchConfig())

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
                  sessionSnapshot,
                  configSnapshot,
                } = self
                if (!configSnapshot) {
                  return
                }

                // Guard: if session is already loaded, don't re-process
                if (self.blankSession || self.sessionSpec || self.hubSpec) {
                  return
                }

                if (sessionSnapshot) {
                  await this.loadSessionPluginsIfNeeded(sessionSnapshot)
                } else if (isSharedSession) {
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
                  await this.fetchLocalSession()
                } else if (isHubSession) {
                  // this is later in the list: prioritize local session over
                  // "hub spec" since hub is left in URL even when there may be
                  // a local session
                  this.decodeHubSpec()
                  self.setBlankSession(true)
                } else if (self.sessionQuery) {
                  // if there was a sessionQuery and we don't recognize it,
                  // start a blank session and show a warning instead of crashing
                  self.setSessionWarning(
                    `Unrecognized session format: "${self.sessionQuery}"`,
                  )
                  self.setBlankSession(true)
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
        } catch (e) {
          console.error(e)
          self.setConfigError(e)
        }
      })()
    },
  }))

export type SessionLoaderModel = Instance<typeof SessionLoader>

export default SessionLoader
