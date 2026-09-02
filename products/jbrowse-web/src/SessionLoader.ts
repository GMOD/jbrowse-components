import { DEFAULT_SHARE_URL, deleteQueryParams } from '@jbrowse/app-core'
import {
  dropVendoredPlugins,
  pluginsNotIn,
} from '@jbrowse/core/pluginDefinitions'
import { createElementId } from '@jbrowse/core/util/types/mst'
import { getSnapshot, isAlive, types } from '@jbrowse/mobx-state-tree'
import { scheduleDetachedDestroy } from '@jbrowse/product-core'
import { autorun } from 'mobx'

import { clearCrashedSession, readCrashedSession } from './crashedSession.ts'
import { createPluginManager } from './createPluginManager.ts'
import {
  getPermanentPlugins,
  markPermanentPluginLoadFinished,
} from './permanentPlugins.ts'
import { resolveConfigPath } from './resolveConfigPath.ts'
import {
  buildLgvInit,
  fetchRemoteConfig,
  getSessionQueryType,
  loadPluginRecords,
  readSessionFromIDB,
  readSessionFromStorage,
  stripPrefix,
  writeSessionToIDB,
} from './sessionLoaderHelpers.ts'
import { arePluginsRemembered } from './trustedPlugins.ts'
import {
  checkPlugins,
  fromUrlSafeB64,
  readConf,
  readSessionFromDynamo,
  shareEndpoint,
} from './util.ts'

import type { CrashedSession } from './crashedSession.ts'
import type { SessionSource, SessionTriagedInfo, Snap } from './types.ts'
import type {
  PluginLoadFailure,
  PluginRecord,
} from '@jbrowse/core/PluginLoader'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'
import type { Instance, IStateTreeNode } from '@jbrowse/mobx-state-tree'

type ReloadPluginManagerCallback = (
  configSnapshot: Snap,
  sessionSnapshot: Snap,
) => void

// PluginManager types rootModel as AbstractRootModel, which is the shape every
// product shares; `detach` belongs to jbrowse-web's, and this file only ever
// runs against that one. Duck-typed rather than imported because rootModel.ts
// is downstream of here, through createPluginManager.
interface DetachableRootModel extends IStateTreeNode {
  detach: () => void
}

/**
 * #stateModel SessionLoader
 * #internal app-shell boot wiring, not a user-facing API — kept out of the
 * website docs, documented here for contributors
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
    crashedSession: CrashedSession | undefined
    runtimePlugins: PluginRecord[] | undefined
    sessionPlugins: PluginRecord[] | undefined
    pluginLoadFailures: PluginLoadFailure[]
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
     * Set when the local session this boot was asked to restore is the one a
     * previous boot of this tab crashed on. Holds the session at the offer
     * instead of restoring it — see fetchLocalSession.
     */
    crashedSession: undefined,
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
     * Plugins a config or session named that could not be loaded. Collected
     * rather than thrown so the session still opens; reported to the user once
     * it exists (createPluginManager).
     */
    pluginLoadFailures: [],
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
     * set when a plugin reload has already built the replacement loader, so a
     * second reload request arriving off the same rootModel is declined rather
     * than building a third. A plain unmount (StrictMode's double-invoked
     * effect, a Fast Refresh remount) leaves it false, and that loader is
     * reused as-is.
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
      // length, not presence: `&hubURL=` (or `&hubURL=,,`) parses to an empty
      // array, which is still truthy. That routed the load to loadHubSpec, which
      // has no first URL to connect to and returns without ever calling
      // setSession — a JBrowse with no session at all and no diagnostic. An
      // empty list is no hub, so fall through to the normal default session.
      return !!self.hubURL?.length
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
     * the loc/assembly/tracks/... URL shorthand as a LinearGenomeView init.
     * One place, because all three consumers (a fresh jb1-style spec, the
     * layer-onto-defaultSession path, and the shorthand riding along on a hub)
     * must read exactly the same params — a getter that forgot one would drop
     * it on only one of the three routes. Keys the URL omits are absent, not
     * undefined (see buildLgvInit).
     */
    get urlViewInit() {
      return buildLgvInit({
        loc: self.loc,
        assembly: self.assembly,
        tracks: self.tracks,
        tracklist: self.tracklist,
        nav: self.nav,
        highlight: self.highlight,
        regions: self.regions,
      })
    },
    /**
     * #getter
     */
    get resolvedConfigPath() {
      return resolveConfigPath(self.configPath)
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
     *
     * Gated on the init being non-empty rather than on `isJb1StyleSession`
     * (loc || assembly): applyDefaultSessionViewInit resolves the assembly from
     * the view itself, so `&extendSession=true&tracks=…` — adding tracks to a
     * curated defaultSession, with no navigation — is meaningful and used to be
     * dropped silently for want of a `&loc=`.
     */
    get defaultSessionViewInit() {
      const init = self.urlViewInit
      return self.extendDefaultSession && Object.keys(init).length
        ? init
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
     * Production code commits plugins through `setConfigAndPlugins`, which pairs
     * them with the config snapshot so `ready` can't observe one without the
     * other; this sets them alone, for tests driving the loader's state directly.
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
     * Records plugins that failed to load. Appends, because a session's plugins
     * and its config's plugins are loaded by separate passes and both can fail.
     */
    addPluginLoadFailures(failures: PluginLoadFailure[]) {
      self.pluginLoadFailures = [...self.pluginLoadFailures, ...failures]
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
     */
    setCrashedSession(args?: CrashedSession) {
      self.crashedSession = args
    },
    /**
     * #action
     * Forgets the `session=` this boot was asked for, once it has decided not
     * to open it (crash recovery's "start fresh"). Its own action rather than a
     * write in that one, which is async — past its first await an MST action is
     * no longer in an action.
     */
    clearSessionQuery() {
      self.sessionQuery = undefined
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
        markPermanentPluginLoadFinished()
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
        // Detach in this action, destroy on a later task. This runs from a
        // React effect cleanup, and React reads the outgoing props after that —
        // destroying here is what crashed the page. ADR-069.
        //
        // The destroy is not optional and its absence was a regression: the
        // whole plugin-facing tree hangs off this root, so never destroying it
        // silently drops every `beforeDestroy` in it. jbrowse-plugin-apollo's
        // internet account closes its websocket there and its session aborts
        // its in-flight fetches; reported by Apollo against #5618.
        ;(rootModel as unknown as DetachableRootModel).detach()
        scheduleDetachedDestroy(rootModel)
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
        // The user's permanent plugins load beside the config's own, and the
        // config's entry wins a collision — it is pinned to the version this
        // deployment was built against, matching both the session-plugin dedupe
        // in loadSession and Desktop's global-plugin merge.
        //
        // No trust gate, and that asymmetry is deliberate: a config's plugins
        // can arrive from another origin by link, while this list is only ever
        // written by a click inside this app on this config.
        const configPlugins = snap.plugins ?? []
        const { records, failures } = await loadPluginRecords([
          ...configPlugins,
          ...pluginsNotIn(getPermanentPlugins(), configPlugins),
        ])
        self.addPluginLoadFailures(failures)
        self.setConfigAndPlugins(snap, records)
      } catch (e) {
        console.error(e)
        self.setConfigError(e)
        // an error on screen is proof the tab survived this load, which is all
        // the crash marker asks; left armed, a config an admin later fixes
        // would still put the user's permanent plugins into safe mode
        markPermanentPluginLoadFinished()
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
        // Two sets are dropped before anything is fetched. The vendored ones,
        // because core already registers what they provide; and the ones the
        // config's own list already loaded, because PluginManager.addPlugin
        // refuses a second copy by name anyway — so web was fetching and
        // evaluating a duplicate bundle, and putting it through the trust gate,
        // to arrive where it already was. react-app and desktop both dedupe at
        // the equivalent seam and web was the one product that did not.
        //
        // The config's entry is the one kept, matching those two products and the
        // merge order in createPluginManager: a config and a session naming the
        // same plugin at different pinned versions run the config's version, as
        // they did before this dedupe. `initialize` awaits loadConfig before any
        // route reaches here, so runtimePlugins is settled.
        const sessionPlugins = pluginsNotIn(
          dropVendoredPlugins(snap.sessionPlugins ?? []),
          (self.runtimePlugins ?? []).map(r => r.definition),
        )
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
          const { records, failures } = await loadPluginRecords(sessionPlugins)
          self.addPluginLoadFailures(failures)
          self.setSessionPlugins(records)
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
        // cheap local check first, for the same reason as loadSession:
        // checkPlugins fetches the plugin store and THROWS when it is
        // unreachable, and that throw becomes a configError — a dead app. An
        // already-remembered plugin must not be able to die that way just
        // because the store is down.
        if (
          isCrossOrigin &&
          !arePluginsRemembered(configPlugins) &&
          !(await checkPlugins(configPlugins))
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
     *
     * Ahead of both, the one case where restoring is the wrong answer: this tab
     * already opened this exact session and crashed to the app-level
     * ErrorBoundary doing it. The autosave rewrote the snapshot at most 400ms
     * before that, so `FatalErrorDialog`'s **Refresh** lands back here and
     * crashes again — the loop this offer breaks. What the marker names is the
     * id in the URL rather than the id that got loaded, so the fork above is
     * still recognized: it crashed under an id this URL has never carried.
     */
    async fetchLocalSession() {
      const query = stripPrefix(self.sessionQuery!)
      const crashed = readCrashedSession()
      if (crashed?.id === query) {
        self.setCrashedSession(crashed)
        return
      }
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
        shareEndpoint(
          readConf(self.configSnapshot, 'shareURL', DEFAULT_SHARE_URL),
          'load',
        ),
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
        spec: {
          sessionTracks: self.sessionTracksParsed,
          views: [{ type: 'LinearGenomeView', ...self.urlViewInit }],
        },
      })
    },
    /**
     * #action
     */
    decodeHubSpec() {
      self.setSessionSource({
        type: 'hub',
        // detached copy: sessionSource is a types.frozen prop, so handing it
        // self.hubURL would park a live node from this loader's own tree
        // inside a value that is supposed to be plain JSON
        hubSpec: { hubURL: [...(self.hubURL ?? [])] },
        // a hand-written link may carry the loc/assembly/tracks shorthand too;
        // loadHubSpec applies it on top of the hub session. Gated on loc/assembly
        // (not on the init being non-empty, as the defaultSession path is): a hub
        // launch resolves against one of the hub's own genomes, so an init with
        // no way to name one has nothing to launch against.
        viewInit: self.isJb1StyleSession ? self.urlViewInit : undefined,
        // ungated, unlike viewInit: a `&sessionTracks=` is worth registering
        // whether or not the link also says where to look. Dropping it here is
        // what made `?hubURL=…&sessionTracks=…&tracks=my_track` open the hub
        // with `my_track` unresolvable and no diagnostic, while the same URL
        // handed to parseSessionSpecUrl (Desktop's "Open JBrowse Web link…")
        // carried the track — one link, two answers.
        sessionTracks: self.sessionTracksParsed,
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
        } else if (self.extendDefaultSession && self.isJb1StyleSession) {
          // `&extendSession=true` names the *config's* defaultSession as the
          // thing to layer onto, so the shorthand doesn't build a session of its
          // own here — it is applied to the default one in initSession, via
          // defaultSessionViewInit. Outranks the hub branch below, which would
          // otherwise replace that defaultSession outright.
          self.setSessionSource({ type: 'default' })
        } else if (self.isHubSession) {
          // lower priority than local session: hubURL is left in URL even
          // when a local session exists.
          //
          // Above the loc/assembly shorthand, though: a hub is the only param
          // that brings its own assemblies and tracks, so a link carrying both
          // is asking to navigate *inside* the hub. Ranking the shorthand first
          // built a bare LGV and dropped the hub with no diagnostic. The
          // shorthand rides along on the hub session (see decodeHubSpec).
          self.decodeHubSpec()
        } else if (self.isJb1StyleSession) {
          // the loc/assembly/tracks shorthand ranks below every explicit
          // `session=` prefix: an explicit session always wins over a stray
          // loc (generated URLs never combine them — loc is stripped once
          // consumed — so this only disambiguates hand-crafted URLs)
          self.decodeJb1StyleSession()
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
      await self.loadConfigAndPlugins(snap)
      self.setSessionTriaged(undefined)
      await this.loadSessionByType()
    },
    /**
     * #action
     * The crash offer's "open it anyway": the user may know the cause was
     * transient (a lazy chunk that failed to fetch, a plugin that has since
     * loaded), so this restores exactly what the boot would have restored.
     *
     * The marker is dropped FIRST, and that is what makes the second attempt a
     * real one rather than a recursion — fetchLocalSession re-reads it. If this
     * crashes again the ErrorBoundary writes a fresh marker, so the offer comes
     * back on the next boot rather than being spent.
     *
     * Back through loadSessionByType rather than straight to fetchLocalSession,
     * so this is the same dispatch an ordinary boot takes and inherits its
     * catch: "Local session not found" (the snapshot moved while the offer was
     * up) has to become an error sessionSource, not an unhandled rejection off
     * a button.
     */
    async openCrashedSession() {
      clearCrashedSession()
      self.setCrashedSession(undefined)
      await this.loadSessionByType()
    },
    /**
     * #action
     * The crash offer's other half: boot the way a first visit would, WITHOUT
     * destroying the session that crashed.
     *
     * Keeping it is the point, so it is made durable rather than assumed
     * durable — the sessionStorage copy is the fresher of the two autosaves and
     * the new session's own autosave is about to overwrite it, which is how a
     * session that crashed inside the first 400ms would be lost by a feature
     * whose whole purpose is not losing it. After this it is an ordinary row in
     * the autosave list, reopenable from the session manager.
     *
     * `session=local-<id>` then has to come out of the URL. The marker is gone
     * by this point, so nothing else would stop the next reload restoring the
     * session we just declined — and dropping only that param is what makes
     * this a rung below `factoryReset`, which drops the config and every other
     * option with it.
     */
    async startFreshSession() {
      const id = self.crashedSession?.id
      // no sessionStorage copy means this id was never this tab's own current
      // session — fetchLocalSession's IndexedDB branch, where it is already a
      // row in the autosave database and there is nothing to rescue
      const snap = id ? readSessionFromStorage(id) : undefined
      if (snap) {
        await writeSessionToIDB(snap, self.configPath ?? '')
      }
      clearCrashedSession()
      self.setCrashedSession(undefined)
      deleteQueryParams(['session'])
      // and out of the loader too, so the two readings of "which session did
      // this boot ask for" agree — doAnalytics reports sessionQuery, and a
      // plugin reload rebuilds the next loader from this one's snapshot
      self.clearSessionQuery()
      self.setSessionSource({ type: 'default' })
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
