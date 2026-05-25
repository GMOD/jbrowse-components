import PluginLoader from '@jbrowse/core/PluginLoader'
import { openLocation } from '@jbrowse/core/util/io'
import { createElementId } from '@jbrowse/core/util/types/mst'
import { destroy, getSnapshot, isAlive, types } from '@jbrowse/mobx-state-tree'
import { openDB } from 'idb'

import { createPluginManager } from './createPluginManager.ts'
import { readSessionFromDynamo } from './sessionSharing.ts'
import {
  addRelativeUris,
  checkPlugins,
  fromUrlSafeB64,
  readConf,
} from './util.ts'

import type { SessionDB, SessionTriagedInfo } from './types.ts'
import type { PluginDefinition, PluginRecord } from '@jbrowse/core/PluginLoader'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

type ReloadPluginManagerCallback = (
  configSnapshot: Record<string, unknown>,
  sessionSnapshot: Record<string, unknown>,
) => void

type Snap = Record<string, unknown>

// --- Pure / IO helpers -----------------------------------------------------

async function loadPluginRecords(defs: PluginDefinition[]) {
  const loader = new PluginLoader(defs, {
    fetchESM: url => import(/* webpackIgnore:true */ url),
  })
  loader.installGlobalReExports(window)
  return [...(await loader.load(window.location.href))]
}

export function readSessionFromStorage(query: string) {
  const str = sessionStorage.getItem('current')
  if (str) {
    const snap = JSON.parse(str).session ?? {}
    if (query === snap.id) {
      return snap as Snap
    }
  }
  return undefined
}

export async function readSessionFromIDB(query: string) {
  try {
    const db = await openDB<SessionDB>('sessionsDB', 2, {
      upgrade(db) {
        db.createObjectStore('metadata')
        db.createObjectStore('sessions')
      },
    })
    return await db.get('sessions', query)
  } catch (e) {
    console.error(e)
    return undefined
  }
}

async function fetchRemoteConfig(configPath: string) {
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
  return { config, configUri }
}

function buildJb1SessionSpec(args: {
  loc?: string
  tracks?: string
  assembly?: string
  tracklist?: boolean
  nav?: boolean
  highlight?: string
  sessionTracks: unknown
}) {
  return {
    sessionTracks: args.sessionTracks,
    views: [
      {
        type: 'LinearGenomeView',
        tracks: args.tracks?.split(','),
        sessionTracks: args.sessionTracks,
        loc: args.loc,
        assembly: args.assembly,
        tracklist: args.tracklist,
        nav: args.nav,
        highlight: args.highlight?.split(' '),
      },
    ],
  }
}

const stripPrefix = (s: string) =>
  s.replace(/^(share|spec|encoded|json|local)-/, '')

// --- Model ----------------------------------------------------------------

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
    sessionName: types.maybe(types.string),
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
    configSnapshot: types.frozen<Snap | undefined>(undefined),
    /**
     * #property
     */
    sessionSnapshot: types.frozen<Snap | undefined>(undefined),
  })
  .volatile(() => ({
    /**
     * #volatile
     */
    sessionTriaged: undefined as SessionTriagedInfo | undefined,
    /**
     * #volatile
     */
    sessionSpec: undefined as Snap | undefined,
    /**
     * #volatile
     */
    hubSpec: undefined as Snap | undefined,
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

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    sessionError: undefined as unknown,
    /**
     * #volatile
     */

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    configError: undefined as unknown,
    /**
     * #volatile
     */
    pluginManager: undefined as PluginManager | undefined,
    /**
     * #volatile
     */

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    pluginManagerError: undefined as unknown,
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
      // session-plugins are only needed when we're loading from a snapshot
      const needSessionPlugins =
        !self.sessionError && !self.blankSession && !self.sessionSpec
      return Boolean(
        self.runtimePlugins && (!needSessionPlugins || self.sessionPlugins),
      )
    },
    /**
     * #getter
     */
    get isSessionLoaded() {
      return (
        self.blankSession ||
        self.sessionError !== undefined ||
        self.sessionSnapshot !== undefined ||
        self.sessionSpec !== undefined
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
      return self.configPath || window.__jbrowseConfigPath || 'config.json'
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
    setConfigSnapshot(snap: Snap) {
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
    setSessionSnapshot(snap: Snap) {
      self.sessionSnapshot = snap
    },
    /**
     * #action
     */
    setPluginManager(pm: PluginManager | undefined) {
      self.pluginManager = pm
    },
    /**
     * #action
     */
    setPluginManagerError(error: unknown) {
      self.pluginManagerError = error
    },
    /**
     * #action
     * Builds the pluginManager (and rootModel) from the loaded config/session.
     * Idempotent: a second call while one already exists is a no-op.
     */
    buildPluginManager(reloadCallback: ReloadPluginManagerCallback) {
      if (self.pluginManager) {
        return
      }
      try {
        self.pluginManager = createPluginManager(self, reloadCallback)
      } catch (e) {
        console.error(e)
        self.pluginManagerError = e
      }
    },
    /**
     * #action
     * Tears down the rootModel. Saves the live session snapshot back to the
     * loader first so HMR (which reuses this loader) can restore it.
     */
    disposePluginManager() {
      const pm = self.pluginManager
      if (pm?.rootModel) {
        const { rootModel } = pm
        const { session } = rootModel
        // isAlive check crucial because if not a 'dead' session is
        // snapshotted and the safeReference in activeWidgets is stripped from
        // the snapshot (xref #5414)
        if (session && isAlive(session)) {
          self.sessionSnapshot = getSnapshot(session)
        }
        destroy(rootModel)
      }
      self.pluginManager = undefined
    },
  }))
  .actions(self => ({
    /**
     * #action
     */
    async fetchPlugins(config: { plugins?: PluginDefinition[] }) {
      try {
        self.setRuntimePlugins(await loadPluginRecords(config.plugins ?? []))
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
        const sessionPlugins = snap.sessionPlugins ?? []
        if ((await checkPlugins(sessionPlugins)) || userAcceptedConfirmation) {
          self.setSessionPlugins(await loadPluginRecords(sessionPlugins))
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
        self.setSessionError(e)
      }
    },
    /**
     * #action
     */
    async fetchConfig() {
      const configPath = self.resolvedConfigPath
      // ?config=none skips loading; useful for ?hubURL which may not need a
      // config (but can still be combined with one if e.g. config has plugins)
      if (configPath === 'none') {
        self.setConfigSnapshot({})
      } else {
        const { config, configUri } = await fetchRemoteConfig(configPath)
        const configPlugins = config.plugins ?? []
        const isCrossOrigin = configUri.hostname !== window.location.hostname
        if (isCrossOrigin && !(await checkPlugins(configPlugins))) {
          self.setSessionTriaged({
            snap: config,
            origin: 'config',
            reason: configPlugins,
          })
        } else {
          await this.fetchPlugins(config)
          self.setConfigSnapshot(config)
        }
      }
    },
    /**
     * #action
     * Helper to load a decoded session with a fresh ID. New IDs prevent
     * conflicts when the same session is open in multiple tabs.
     */
    async loadDecodedSession(session: Snap) {
      await this.loadSession({ ...session, id: createElementId() })
    },
    /**
     * #action
     * Tries sessionStorage (current) then IndexedDB (autosaved).
     */
    async fetchLocalSession() {
      const query = stripPrefix(self.sessionQuery!)
      const snap =
        readSessionFromStorage(query) ?? (await readSessionFromIDB(query))
      if (snap) {
        await this.loadDecodedSession(snap)
      } else {
        throw new Error('Local session not found')
      }
    },
    /**
     * #action
     */
    async fetchSharedSession() {
      const defaultURL = 'https://share.jbrowse.org/api/v1/'
      const decrypted = await readSessionFromDynamo(
        `${readConf(self.configSnapshot, 'shareURL', defaultURL)}load`,
        self.sessionQuery ?? '',
        self.password ?? '',
      )
      await this.loadDecodedSession(JSON.parse(await fromUrlSafeB64(decrypted)))
    },
    /**
     * #action
     */
    async decodeEncodedUrlSession() {
      const session = JSON.parse(
        await fromUrlSafeB64(stripPrefix(self.sessionQuery!)),
      )
      await this.loadDecodedSession(session)
    },
    /**
     * #action
     */
    async decodeJsonUrlSession() {
      const { session } = JSON.parse(stripPrefix(self.sessionQuery!))
      await this.loadDecodedSession(session)
    },
    /**
     * #action
     */
    decodeSessionSpec() {
      self.sessionSpec = JSON.parse(stripPrefix(self.sessionQuery!))
    },
    /**
     * #action
     */
    decodeJb1StyleSession() {
      self.sessionSpec = buildJb1SessionSpec({
        loc: self.loc,
        tracks: self.tracks,
        assembly: self.assembly,
        tracklist: self.tracklist,
        nav: self.nav,
        highlight: self.highlight,
        sessionTracks: self.sessionTracksParsed,
      })
    },
    /**
     * #action
     */
    decodeHubSpec() {
      self.hubSpec = { hubURL: self.hubURL }
    },
  }))
  .actions(self => ({
    /**
     * #action
     */
    async loadSessionByType() {
      try {
        if (self.sessionSnapshot) {
          // HMR / reload path: snapshot pre-set, just load plugins if needed
          if (!self.sessionPlugins) {
            await self.loadSession(
              self.sessionSnapshot as {
                sessionPlugins?: PluginDefinition[]
                id: string
              },
            )
          }
        } else if (self.isSharedSession) {
          await self.fetchSharedSession()
        } else if (self.isSpecSession) {
          self.decodeSessionSpec()
        } else if (self.isJb1StyleSession) {
          self.decodeJb1StyleSession()
        } else if (self.isEncodedSession) {
          await self.decodeEncodedUrlSession()
        } else if (self.isJsonSession) {
          await self.decodeJsonUrlSession()
        } else if (self.isLocalSession) {
          await self.fetchLocalSession()
        } else if (self.isHubSession) {
          // lower priority than local session: hubURL is left in URL even
          // when a local session exists
          self.decodeHubSpec()
          self.setBlankSession(true)
        } else if (self.sessionQuery) {
          throw new Error(
            `Unrecognized URL session format: "${self.sessionQuery}"`,
          )
        } else {
          self.setBlankSession(true)
        }
      } catch (e) {
        console.error(e)
        self.setSessionError(e)
      }
    },
    /**
     * #aftercreate
     */
    afterCreate() {
      void (async () => {
        try {
          // eslint-disable-next-line unicorn/prefer-ternary
          if (self.configSnapshot) {
            // HMR / reload: snapshot already URI-stamped, just load plugins
            await self.fetchPlugins(
              self.configSnapshot as { plugins?: PluginDefinition[] },
            )
          } else {
            await self.fetchConfig()
          }
          await this.loadSessionByType()
        } catch (e) {
          console.error(e)
          self.setConfigError(e)
        }
      })()
    },
  }))

export type SessionLoaderModel = Instance<typeof SessionLoader>

export default SessionLoader
