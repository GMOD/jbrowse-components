import { createElementId } from '@jbrowse/core/util/types/mst'
import { destroy, getSnapshot, isAlive, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { createPluginManager } from './createPluginManager.ts'
import {
  buildJb1SessionSpec,
  fetchRemoteConfig,
  loadPluginRecords,
  readSessionFromIDB,
  readSessionFromStorage,
  splitHighlights,
  stripPrefix,
} from './sessionLoaderHelpers.ts'
import { readSessionFromDynamo } from './sessionSharing.ts'
import { checkPlugins, fromUrlSafeB64, readConf } from './util.ts'

import type { SessionSource, SessionTriagedInfo, Snap } from './types.ts'
import type { PluginDefinition, PluginRecord } from '@jbrowse/core/PluginLoader'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

type ReloadPluginManagerCallback = (
  configSnapshot: Snap,
  sessionSnapshot: Snap,
) => void

const SessionLoader = types
  .model('SessionLoader', {
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
     * the single resolved session, also the HMR/reload restore vehicle (preset
     * to a `snapshot` variant when rebuilding from a live session)
     */
    sessionSource: types.frozen<SessionSource | undefined>(undefined),
  })
  .volatile(() => ({
    /**
     * #volatile
     */
    sessionTriaged: undefined as SessionTriagedInfo | undefined,
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
    /**
     * #volatile
     */
    buildAutorunDisposer: undefined as (() => void) | undefined,
    /**
     * #volatile
     * guards initialize() to run exactly once per loader, even across the
     * activate/deactivate/activate cycle StrictMode drives on mount. Not reset
     * by deactivate (unlike buildAutorunDisposer) so a remount never refetches.
     */
    initializeStarted: false,
  }))
  .views(self => ({
    /**
     * #getter
     * the `session=` URL param's type prefix (`share`/`spec`/`encoded`/`json`/
     * `local`), or undefined when there's no recognized prefix. Mirrors the
     * prefixes stripped by stripPrefix()
     */
    get sessionQueryType() {
      return self.sessionQuery?.match(/^(share|spec|encoded|json|local)-/)?.[1]
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
     * reads the opt-in config.json flag that makes URL params layer onto the
     * configured defaultSession instead of replacing it
     */
    get extendDefaultSession() {
      const config = self.configSnapshot?.configuration as
        | { extendDefaultSessionWithUrlParams?: boolean }
        | undefined
      return !!config?.extendDefaultSessionWithUrlParams
    },
    /**
     * #getter
     */
    get pluginsLoaded() {
      // session-plugins are only needed when restoring a full session snapshot
      const needSessionPlugins = self.sessionSource?.type === 'snapshot'
      return Boolean(
        self.runtimePlugins && (!needSessionPlugins || self.sessionPlugins),
      )
    },
    /**
     * #getter
     */
    get isSessionLoaded() {
      return self.sessionSource !== undefined
    },
    /**
     * #getter
     */
    get sessionTracksParsed(): Record<string, unknown>[] {
      return self.sessionTracks ? JSON.parse(self.sessionTracks) : []
    },
    /**
     * #getter
     */
    get resolvedConfigPath() {
      return self.configPath || window.__jbrowseConfigPath || 'config.json'
    },
  }))
  .views(self => ({
    /**
     * #getter
     */
    get ready(): boolean {
      // runtimePlugins and configSnapshot are committed together in
      // loadConfigAndPlugins, so pluginsLoaded implies configSnapshot is set
      return self.isSessionLoaded && !self.configError && self.pluginsLoaded
    },
    /**
     * #getter
     * URL-derived init (loc/tracks/highlight/...) applied onto the
     * defaultSession's first view when `extendDefaultSession` is enabled,
     * otherwise undefined
     */
    get defaultSessionViewInit() {
      return self.extendDefaultSession && self.isJb1StyleSession
        ? {
            loc: self.loc,
            assembly: self.assembly,
            tracks: self.tracks?.split(','),
            tracklist: self.tracklist,
            nav: self.nav,
            highlight: self.highlight
              ? splitHighlights(self.highlight)
              : undefined,
          }
        : undefined
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
     * Commits config + plugins in a single action so reactions never observe
     * runtimePlugins set while configSnapshot is still undefined (which would
     * build the rootModel with `jbrowse: undefined`).
     */
    setConfigAndPlugins(snap: Snap, plugins: PluginRecord[]) {
      self.runtimePlugins = plugins
      self.configSnapshot = snap
    },
    /**
     * #action
     */
    setSessionTriaged(args?: SessionTriagedInfo) {
      self.sessionTriaged = args
    },
    /**
     * #action
     * Sets the resolved session that the build will apply. Producer of every
     * loadSessionByType branch; consumed once by initSession.
     */
    setSessionSource(source: SessionSource) {
      self.sessionSource = source
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
     * Tears down the rootModel. Saves the live session back into sessionSource
     * first so HMR (which reuses this loader) can restore it.
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
          self.sessionSource = {
            type: 'snapshot',
            snapshot: getSnapshot(session),
          }
        }
        destroy(rootModel)
      }
      self.pluginManager = undefined
    },
  }))
  .actions(self => ({
    /**
     * #action
     * Resolves a config: loads its plugin records, then commits them together
     * with configSnapshot in a single action (setConfigAndPlugins) so `ready`
     * never observes plugins-loaded-but-config-undefined.
     */
    async loadConfigAndPlugins(snap: Snap & { plugins?: PluginDefinition[] }) {
      try {
        const plugins = await loadPluginRecords(snap.plugins ?? [])
        self.setConfigAndPlugins(snap, plugins)
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
          self.setSessionSource({
            type: 'snapshot',
            snapshot: snap,
          })
        } else {
          self.setSessionTriaged({
            snap,
            origin: 'session',
            reason: sessionPlugins,
          })
        }
      } catch (e) {
        console.error(e)
        self.setSessionSource({
          type: 'error',
          error: e,
        })
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
        // commit an empty config so `ready` can flip true; otherwise
        // runtimePlugins stays undefined and the app loads forever
        await this.loadConfigAndPlugins({})
      } else {
        const { config, configUri } = await fetchRemoteConfig(configPath)
        const configPlugins = config.plugins ?? []
        const isCrossOrigin = configUri.origin !== window.location.origin
        if (isCrossOrigin && !(await checkPlugins(configPlugins))) {
          self.setSessionTriaged({
            snap: config,
            origin: 'config',
            reason: configPlugins,
          })
        } else {
          await this.loadConfigAndPlugins(config)
        }
      }
    },
    /**
     * #action
     * Loads a session that arrived from OUTSIDE this browser's local storage
     * (a share link, a url-encoded/json session, or a triage-accepted session)
     * and gives it a fresh local id. The new id makes it an independent local
     * session, so opening the same external URL in two tabs doesn't make them
     * autosave over each other. Contrast `fetchLocalSession`, which restores an
     * already-local session and keeps its id. Pass `userAcceptedConfirmation`
     * when the caller has shown the user a plugin triage dialog and they
     * accepted.
     */
    async loadImportedSession(
      session: Snap,
      userAcceptedConfirmation?: boolean,
    ) {
      const newId = createElementId()
      console.log('[localsession] loadImportedSession mint id', {
        oldId: (session as { id?: string }).id,
        newId,
        time: performance.now(),
      })
      await this.loadSession(
        {
          ...session,
          id: newId,
        },
        userAcceptedConfirmation,
      )
    },
    /**
     * #action
     * Commits a config snapshot that was previously surfaced via triage —
     * loads its plugins and applies it with a fresh ID.
     */
    async applyTriagedConfig(snap: Snap) {
      await this.loadConfigAndPlugins({ ...snap, id: createElementId() })
    },
    /**
     * #action
     * Restores an already-local session named by the URL's `local-<id>`. Tries
     * sessionStorage (current) then IndexedDB (autosaved), and keeps the
     * existing id (unlike `loadImportedSession`) so the URL keeps pointing at a
     * session that is already persisted.
     */
    async fetchLocalSession() {
      const query = stripPrefix(self.sessionQuery!)
      const fromStorage = readSessionFromStorage(query)
      const fromIDB = fromStorage ? undefined : await readSessionFromIDB(query)
      const snap = fromStorage ?? fromIDB
      console.log('[localsession] fetchLocalSession', {
        query,
        foundInStorage: !!fromStorage,
        foundInIDB: !!fromIDB,
        time: performance.now(),
      })
      if (snap) {
        // keep id = query: a fresh id would point the URL at a session not yet
        // written by the debounced autosave (refresh -> "not found") and orphan
        // a new IndexedDB autosave entry on every reload
        await this.loadSession({ ...snap, id: query })
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
      await this.loadImportedSession(JSON.parse(await fromUrlSafeB64(decrypted)))
    },
    /**
     * #action
     */
    async decodeEncodedUrlSession() {
      const session = JSON.parse(
        await fromUrlSafeB64(stripPrefix(self.sessionQuery!)),
      )
      await this.loadImportedSession(session)
    },
    /**
     * #action
     */
    async decodeJsonUrlSession() {
      const { session } = JSON.parse(stripPrefix(self.sessionQuery!))
      await this.loadImportedSession(session)
    },
    /**
     * #action
     */
    decodeSessionSpec() {
      self.setSessionSource({
        type: 'spec',
        spec: JSON.parse(stripPrefix(self.sessionQuery!)),
      })
    },
    /**
     * #action
     */
    decodeJb1StyleSession() {
      self.setSessionSource({
        type: 'spec',
        spec: buildJb1SessionSpec({
          loc: self.loc,
          tracks: self.tracks,
          assembly: self.assembly,
          tracklist: self.tracklist,
          nav: self.nav,
          highlight: self.highlight,
          sessionTracks: self.sessionTracksParsed,
        }),
      })
    },
    /**
     * #action
     */
    decodeHubSpec() {
      self.setSessionSource({
        type: 'hub',
        hubSpec: { hubURL: self.hubURL },
      })
    },
  }))
  .actions(self => ({
    /**
     * #action
     */
    async loadSessionByType() {
      try {
        if (self.sessionSource) {
          // HMR / reload path: sessionSource pre-set to the user's own live
          // session snapshot, whose plugins were already accepted when added
          // in-session. Load those (already-trusted) session plugins without
          // re-triaging. Incoming URL sessions never reach here — they vet via
          // fetchSharedSession etc.
          if (self.sessionSource.type === 'snapshot' && !self.sessionPlugins) {
            await self.loadSession(
              self.sessionSource.snapshot as {
                sessionPlugins?: PluginDefinition[]
                id: string
              },
              true,
            )
          }
        } else if (self.sessionQueryType === 'share') {
          await self.fetchSharedSession()
        } else if (self.sessionQueryType === 'spec') {
          self.decodeSessionSpec()
        } else if (self.isJb1StyleSession) {
          if (self.extendDefaultSession) {
            // layer loc/tracks onto the configured defaultSession (applied in
            // initSession via defaultSessionViewInit) rather than replacing it
            self.setSessionSource({ type: 'default' })
          } else {
            self.decodeJb1StyleSession()
          }
        } else if (self.sessionQueryType === 'encoded') {
          await self.decodeEncodedUrlSession()
        } else if (self.sessionQueryType === 'json') {
          await self.decodeJsonUrlSession()
        } else if (self.sessionQueryType === 'local') {
          await self.fetchLocalSession()
        } else if (self.isHubSession) {
          // lower priority than local session: hubURL is left in URL even
          // when a local session exists
          self.decodeHubSpec()
        } else if (self.sessionQuery) {
          throw new Error(
            `Unrecognized URL session format: "${self.sessionQuery}"`,
          )
        } else {
          self.setSessionSource({ type: 'default' })
        }
      } catch (e) {
        console.error(e)
        self.setSessionSource({ type: 'error', error: e })
      }
    },
    /**
     * #action
     */
    async loadConfig() {
      if (self.configSnapshot) {
        // HMR / reload: snapshot already URI-stamped, just (re)load plugins;
        // re-committing the same configSnapshot is a harmless no-op
        await self.loadConfigAndPlugins(self.configSnapshot)
      } else {
        await self.fetchConfig()
      }
    },
    /**
     * #action
     * A config error short-circuits session loading: the try/catch sits at
     * this level so loadSessionByType is skipped on config failure.
     */
    async initialize() {
      try {
        await this.loadConfig()
        await this.loadSessionByType()
      } catch (e) {
        console.error(e)
        self.setConfigError(e)
      }
    },
    /**
     * #action
     * Attaches a React host: kicks off the one-time config/session load and
     * starts an autorun that fires `buildPluginManager` once `ready` flips
     * true. Idempotent — a second call while already activated is a no-op, and
     * the load only ever runs once (see initializeStarted). Loading lives here
     * rather than in afterCreate so model construction stays side-effect-free
     * and safe under StrictMode's double-invoked useState initializer.
     */
    activate(reloadCallback: ReloadPluginManagerCallback) {
      if (!self.initializeStarted) {
        self.initializeStarted = true
        void this.initialize()
      }
      if (self.buildAutorunDisposer) {
        return
      }
      self.buildAutorunDisposer = autorun(() => {
        if (self.ready) {
          self.buildPluginManager(reloadCallback)
        }
      })
    },
    /**
     * #action
     * Detaches the React host: stops the build autorun and disposes the
     * rootModel.
     */
    deactivate() {
      self.buildAutorunDisposer?.()
      self.buildAutorunDisposer = undefined
      self.disposePluginManager()
    },
  }))

export type SessionLoaderModel = Instance<typeof SessionLoader>

export default SessionLoader
