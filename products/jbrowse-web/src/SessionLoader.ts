import { DEFAULT_SHARE_URL } from '@jbrowse/app-core'
import { dropVendoredPlugins } from '@jbrowse/core/PluginLoader'
import { createElementId } from '@jbrowse/core/util/types/mst'
import { destroy, getSnapshot, isAlive, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { createPluginManager } from './createPluginManager.ts'
import {
  buildJb1SessionSpec,
  buildLgvInit,
  fetchRemoteConfig,
  getSessionQueryType,
  loadPluginRecords,
  readSessionFromIDB,
  readSessionFromStorage,
  stripPrefix,
} from './sessionLoaderHelpers.ts'
import { readSessionFromDynamo } from './sessionSharing.ts'
import { arePluginsRemembered } from './trustedPlugins.ts'
import { checkPlugins, fromUrlSafeB64, readConf } from './util.ts'

import type { SessionSource, SessionTriagedInfo, Snap } from './types.ts'
import type { PluginDefinition, PluginRecord } from '@jbrowse/core/PluginLoader'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

type ReloadPluginManagerCallback = (
  configSnapshot: Snap,
  sessionSnapshot: Snap,
) => void

/**
 * #stateModel SessionLoader
 * Bootstraps a jbrowse-web session from URL params: resolves the config plus the
 * shared/local session sources, builds the plugin manager, and exposes the
 * loading/error state the app shell renders around.
 */
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
     * comma-separated chromosome names to restrict a whole-genome view to (no
     * `loc`), e.g. the main chromosomes without unplaced/alt contigs
     */
    regions: types.maybe(types.string),
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
     * when true, jb1-style URL params (loc/tracks/highlight/...) navigate
     * within the configured defaultSession instead of replacing it
     */
    extendSession: types.maybe(types.boolean),
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
  .volatile<{
    sessionTriaged: SessionTriagedInfo | undefined
    runtimePlugins: PluginRecord[] | undefined
    sessionPlugins: PluginRecord[] | undefined
    configError: unknown
    pluginManager: PluginManager | undefined
    pluginManagerError: unknown
    buildAutorunDisposer: (() => void) | undefined
    initializeStarted: boolean
    superseded: boolean
  }>(() => ({
    /**
     * #volatile
     */
    sessionTriaged: undefined,
    /**
     * #volatile
     */
    runtimePlugins: undefined,
    /**
     * #volatile
     */
    sessionPlugins: undefined,
    /**
     * #volatile
     */
    configError: undefined,
    /**
     * #volatile
     */
    pluginManager: undefined,
    /**
     * #volatile
     */
    pluginManagerError: undefined,
    /**
     * #volatile
     */
    buildAutorunDisposer: undefined,
    /**
     * #volatile
     * guards initialize() to run exactly once per loader, even across the
     * activate/deactivate/activate cycle StrictMode drives on mount. Not reset
     * by deactivate (unlike buildAutorunDisposer) so a remount never refetches.
     */
    initializeStarted: false,
    /**
     * #volatile
     * set when a plugin reload has already built the replacement loader, so
     * this one will never be re-activated and can be freed on detach. A plain
     * unmount (StrictMode's double-invoked effect, a Fast Refresh remount)
     * leaves it false, and that loader is reused as-is.
     */
    superseded: false,
  }))
  .views(self => ({
    /**
     * #getter
     * the `session=` URL param's type prefix (`share`/`spec`/`encoded`/`json`/
     * `local`), or undefined when there's no recognized prefix. Mirrors the
     * prefixes stripped by stripPrefix()
     */
    get sessionQueryType() {
      return self.sessionQuery
        ? getSessionQueryType(self.sessionQuery)
        : undefined
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
     * reads the opt-in `&extendSession=true` URL param that makes jb1-style
     * params layer onto the configured defaultSession instead of replacing it
     */
    get extendDefaultSession() {
      return !!self.extendSession
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
        ? buildLgvInit({
            loc: self.loc,
            assembly: self.assembly,
            tracks: self.tracks,
            tracklist: self.tracklist,
            nav: self.nav,
            highlight: self.highlight,
            regions: self.regions,
          })
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
          const snapshot = getSnapshot(session)
          self.sessionSource = {
            type: 'snapshot',
            snapshot,
          }
          // pluginsLoaded treats a 'snapshot' source as requiring
          // sessionPlugins; a default/spec/hub session never loaded any, so
          // without this `ready` would stay false (app stuck on Loading) if
          // the same loader is ever re-activated after this dispose. The
          // already-loaded records restore the snapshot as-is.
          self.sessionPlugins ??= []
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
        const sessionPlugins = dropVendoredPlugins(snap.sessionPlugins ?? [])
        // cheap local checks first: checkPlugins hits the plugin store over the
        // network for any plugin not on a trusted host, and it throws when the
        // store is unreachable. That throw lands in the catch below and replaces
        // the session with an error — so a store outage must not be able to eat
        // an already-trusted session (the plugin-install reload path, which
        // always passes userAcceptedConfirmation, is the common case)
        if (
          userAcceptedConfirmation ||
          arePluginsRemembered(sessionPlugins) ||
          (await checkPlugins(sessionPlugins))
        ) {
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
        // Vendored plugins (e.g. MafViewer) are dropped at load time because
        // core already provides them, so they must not trip the cross-origin
        // trust prompt either — otherwise every remote config that still lists
        // one (jbrowse.org demos do) needs a needless "trust this plugin" click.
        const configPlugins = dropVendoredPlugins(config.plugins ?? [])
        const isCrossOrigin = configUri.origin !== window.location.origin
        if (
          isCrossOrigin &&
          !(await checkPlugins(configPlugins)) &&
          !arePluginsRemembered(configPlugins)
        ) {
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
     * Restores the session named by the URL's `local-<id>`, tried in
     * sessionStorage (this tab's current) then IndexedDB (shared autosave).
     *
     * A sessionStorage hit means this same tab is reloading its own session, so
     * we keep id = query: the URL keeps pointing at a session this tab already
     * persisted (a fresh id would race the debounced autosave -> "not found" on
     * a fast refresh, and orphan a new IndexedDB entry every reload).
     *
     * An IndexedDB-only hit means another context (a new tab off a copied URL, a
     * link, a fresh visit) is adopting an id this tab never owned. IndexedDB is
     * shared across tabs, so we fork a fresh id via `loadImportedSession`;
     * otherwise both tabs would autosave over the same slot and fight.
     */
    async fetchLocalSession() {
      const query = stripPrefix(self.sessionQuery!)
      const fromStorage = readSessionFromStorage(query)
      const fromIDB = fromStorage ? undefined : await readSessionFromIDB(query)
      if (fromStorage) {
        await this.loadSession({ ...fromStorage, id: query })
      } else if (fromIDB) {
        await this.loadImportedSession(fromIDB)
      } else {
        throw new Error('Local session not found')
      }
    },
    /**
     * #action
     */
    async fetchSharedSession() {
      const decrypted = await readSessionFromDynamo(
        `${readConf(self.configSnapshot, 'shareURL', DEFAULT_SHARE_URL)}load`,
        self.sessionQuery ?? '',
        self.password ?? '',
      )
      await this.loadImportedSession(
        JSON.parse(await fromUrlSafeB64(decrypted)),
      )
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
          regions: self.regions,
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
        } else if (self.sessionQueryType === 'encoded') {
          await self.decodeEncodedUrlSession()
        } else if (self.sessionQueryType === 'json') {
          await self.decodeJsonUrlSession()
        } else if (self.sessionQueryType === 'local') {
          await self.fetchLocalSession()
        } else if (self.isJb1StyleSession) {
          // the loc/assembly/tracks shorthand ranks below every explicit
          // `session=` prefix: an explicit session always wins over a stray
          // loc (generated URLs never combine them — loc is stripped once
          // consumed — so this only disambiguates hand-crafted URLs)
          if (self.extendDefaultSession) {
            // layer loc/tracks onto the configured defaultSession (applied in
            // initSession via defaultSessionViewInit) rather than replacing it
            self.setSessionSource({ type: 'default' })
          } else {
            self.decodeJb1StyleSession()
          }
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
     * Commits a config snapshot that was surfaced via triage: loads its plugins
     * with a fresh id, clears the (config) triage, then resolves the session.
     * Session loading is deferred to here — `initialize` skips it while a config
     * triage is pending — so the session resolves against the committed config
     * and an untrusted session can't clobber the still-pending config triage
     * (which would otherwise leave the config uncommitted and `ready` stuck).
     * loadSessionByType may itself surface a new (session) triage.
     */
    async applyTriagedConfig(snap: Snap) {
      await self.loadConfigAndPlugins({ ...snap, id: createElementId() })
      self.setSessionTriaged(undefined)
      await this.loadSessionByType()
    },
    /**
     * #action
     * A config error short-circuits session loading: the try/catch sits at
     * this level so loadSessionByType is skipped on config failure.
     */
    async initialize() {
      try {
        await this.loadConfig()
        // Skip session loading when the config didn't fully resolve:
        // - a pending (config) triage defers it until the user accepts via
        //   applyTriagedConfig, which resolves the session against the
        //   committed config
        // - a config/plugin error (swallowed into configError by
        //   loadConfigAndPlugins, so it never reaches the catch below) makes
        //   session loading pointless — `ready` gates on !configError, so the
        //   error banner shows and no plugin manager is built regardless
        if (!self.sessionTriaged && !self.configError) {
          await this.loadSessionByType()
        }
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
     * Marks this loader as replaced by a newer one, so detaching frees it
     * rather than keeping it warm for a possible re-activation.
     */
    setSuperseded() {
      self.superseded = true
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
