import PluginLoader from '@jbrowse/core/PluginLoader'
import PluginManager, { corePluginRecords } from '@jbrowse/core/PluginManager'
import {
  dedupePlugins,
  desktopVendoredPluginNames,
  dropVendoredPlugins,
  pluginDefinitionMetadata,
  pluginDescriptionString,
  pluginUrl,
  samePlugin,
} from '@jbrowse/core/pluginDefinitions'
import { resolveStorePluginRefs } from '@jbrowse/core/util'
import { doAnalytics } from '@jbrowse/core/util/analytics'

import packageJSON from '../../../package.json' with { type: 'json' }
import corePlugins from '../../corePlugins.ts'
import { invokeIpc } from '../../ipc.ts'
import JBrowseRootModelFactory from '../../rootModel/rootModel.ts'
import sessionModelFactory from '../../sessionModel/sessionModel.ts'
import { fetchCJS } from '../../util.tsx'
import { completeConfig } from './configInputs.ts'
import { fetchConfig } from './fetchConfig.ts'
import {
  getGlobalPlugins,
  globalPluginReadErrorMessage,
  globalPluginsGeneration,
  markGlobalPluginLoadFinished,
} from './globalPlugins.ts'
import { launchFromLink } from './launchFromLink.ts'
import { resolveSessionName } from './sessionName.ts'

import type { DesktopRootModel } from '../../rootModel/rootModel.ts'
import type { JBrowseConfigInput } from './types.ts'
import type {
  PluginLoadFailure,
  PluginRecord,
} from '@jbrowse/core/PluginLoader'
import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'

// Everything here reaches corePlugins, and through it every plugin's models,
// adapters and config schemas — the desktop renderer's whole plugin graph. None
// of it is needed to draw the start screen, which has no session: it is needed
// the moment one is opened. So this module is the far side of util.tsx's
// dynamic import, and nothing may import it statically. See util.tsx.
//
// createStartScreenPluginManager stays here even though it needs none of the
// above, and that is not an oversight. Moving it to a module of its own — so the
// start screen could build its manager without pulling the graph — was tried and
// reverted: it left main.js the same size (1,357,376 vs 1,357,165 bytes, i.e.
// nothing, since the graph was already behind the dynamic import either way) and
// it broke the packaged app. The volvox assembly hung at initialized:false with
// an empty error, which is what an RPC worker that never answers looks like.
//
// The suspected mechanism, unconfirmed: `fetchCJS` lives in src/util.tsx, which
// rpcWorker.ts — a separate webpack entry — also imports. Adding a second async
// renderer consumer of it appears to tip splitChunks into extracting a shared
// chunk that the worker then has to load at runtime, and worker chunk loading
// under file:// with publicPath './' is exactly what desktop's webpack config
// warns about. Anyone retrying this should confirm that first; the win on offer
// is deferring the graph from start-screen-mount to session-open, not bytes.

// undefined where there is nothing to load — see `initializeWorker` for what a
// loader costs
function makePluginLoader(definitions: PluginDefinition[]) {
  const toLoad = dropVendoredPlugins(definitions, desktopVendoredPluginNames)
  return toLoad.length
    ? new PluginLoader(toLoad, {
        fetchESM: url => import(/* webpackIgnore:true */ url),
        fetchCJS,
      }).installGlobalReExports(window)
    : undefined
}

function pluginRecords(
  runtimePlugins: PluginRecord[],
  isGlobal: (definition: PluginDefinition) => boolean,
) {
  return [
    ...corePluginRecords(corePlugins),
    ...runtimePlugins.map(({ plugin: P, definition }) => ({
      plugin: new P(),
      definition,
      metadata: {
        ...pluginDefinitionMetadata(definition),
        // the in-session plugin store reads this to lock a global plugin: it
        // is in every session's plugin list but in no session's config, so an
        // uninstall there would filter a list it isn't in
        isGlobal: isGlobal(definition),
      },
    })),
  ]
}

export interface StartScreenPluginManager {
  pluginManager: PluginManager
  failures: PluginLoadFailure[]
  // why the global plugin list came back empty, when that is why
  readError: unknown
}

/**
 * Load a set of definitions and build the manager that holds them.
 *
 * Settled, not all-or-nothing, on both paths: Desktop opens remote hub configs
 * whose plugin urls it has no control over, and one that 404s or needs a newer
 * host than this install used to leave the user with a dead app instead of a
 * session missing one feature — while one unloadable *global* plugin must not
 * cost them the start screen that is the only place to uninstall it. Each caller
 * reports the failures where it has somewhere to report them.
 */
async function buildPluginManager(
  definitions: PluginDefinition[],
  isGlobal: (definition: PluginDefinition) => boolean,
) {
  // Ahead of makePluginLoader, whose dropVendoredPlugins matches on the UMD
  // name a store ref does not carry until the manifest supplies it. Fetches
  // nothing unless a definition is actually a ref, so an offline launch of a
  // config that names none is unaffected.
  const { definitions: resolved, failures: unresolved } =
    await resolveStorePluginRefs(definitions, packageJSON.version)
  const loader = makePluginLoader(resolved)
  const { records, failures } = loader
    ? await loader.loadSettled(window.location.href)
    : { records: [], failures: [] }
  const pluginManager = new PluginManager(pluginRecords(records, isGlobal))
  pluginManager.createPluggableElements()
  return { pluginManager, failures: [...unresolved, ...failures] }
}

// A manager built from the global plugins alone, so the start screen — which
// has no session, and therefore no session plugin manager — can still fire the
// extension points a global plugin contributes to.
//
// The crash marker is cleared in a finally, after configure(): a plugin that
// hangs or takes the renderer down while registering its extension points does
// so as thoroughly as one that does while its module is evaluated, and a throw
// caught here is a renderer that lived to show the error.
async function buildStartScreenPluginManager(): Promise<StartScreenPluginManager> {
  const { plugins, readError } = await getGlobalPlugins()
  try {
    const built = await buildPluginManager(plugins, () => true)
    // no root model to configure against, which every plugin's configure()
    // already guards for (isAbstractMenuManager), but extension points a plugin
    // registers there have to be in place before the start screen renders
    built.pluginManager.configure()
    return { ...built, readError }
  } finally {
    markGlobalPluginLoadFinished()
  }
}

// Built once per list, not once per mount. "Return to start screen" unmounts and
// remounts the start screen, and rebuilding re-fetched and re-evaluated every
// global plugin bundle to arrive at the same manager — appending another
// <script> to <head>, and re-running the bundle's module-level side effects,
// once per round trip. Keyed on the write generation rather than cached
// outright so that removing the plugin that broke a panel still takes effect on
// the way back, which is the recovery this whole surface exists for.
//
// The failures ride along once. The start screen notifies whatever this
// resolves with on every mount, and the build behind a cache hit did not run
// again — so a hit hands back the manager alone rather than re-raising the same
// toasts on every round trip.
let cached:
  | {
      generation: number
      built: Promise<StartScreenPluginManager>
      reported: boolean
    }
  | undefined

export function createStartScreenPluginManager() {
  const generation = globalPluginsGeneration()
  if (cached?.generation !== generation) {
    cached = {
      generation,
      // a rejected promise held forever would make one bad launch permanent, so
      // drop it and let the next mount try again
      built: buildStartScreenPluginManager().catch((e: unknown) => {
        cached = undefined
        throw e
      }),
      reported: false,
    }
  }
  const entry = cached
  return entry.built.then(built => {
    if (entry.reported) {
      return { ...built, failures: [], readError: undefined }
    }
    entry.reported = true
    return built
  })
}

/**
 * Build the session a config describes, and record where its edits are to be
 * saved. Every way of opening a session funnels through here, so `sessionPath`
 * is set exactly once per session and always alongside the snapshot it belongs
 * to — the pair that used to be assembled separately at each call site.
 */
async function openSession(snap: JBrowseConfigInput, sessionPath: string) {
  const pm = await createPluginManager(snap)
  ;(pm.rootModel as DesktopRootModel | undefined)?.setSessionPath(sessionPath)
  return pm
}

/**
 * Open a session or config file from disk. Which of the two it is decides where
 * the session saves, and the main process decides that (see the `loadSession`
 * handler) — opening a config must not overwrite it.
 */
export async function loadPluginManager(filePath: string) {
  const { snap, sessionPath } = await invokeIpc('loadSession', filePath)
  return openSession(snap, sessionPath)
}

/**
 * Open a config snapshot the renderer assembled rather than read — merged hub
 * configs, a quickstart, the config a JBrowse Web link named — as a new session.
 * It has no file behind it, so it gets a fresh autosave path and the first
 * autosave writes it.
 *
 * The snapshot goes straight into the session instead of being written out and
 * read back through `loadSession`, which is what a self-contained spec link
 * needed: its session carries its own `sessionAssemblies` and so has no config
 * at all, and a round trip through the file failed that config's "does not
 * contain any assemblies" check before the spec ever got to supply them.
 */
export async function launchSnapshot(snap: JBrowseConfigInput = {}) {
  return openSession(snap, await invokeIpc('newAutosavePath'))
}

/**
 * Open a JBrowse Web link as a new session. Shared by the File → Session → "Open
 * JBrowse Web link..." dialog and by a jbrowse:// link the main process
 * forwarded as ?specLink=, so both routes build the session identically.
 */
export async function openSpecLink(link: string) {
  return launchFromLink(link, {
    fetchConfig,
    // no defaultSession to invent: loadSessionSpec replaces the session this
    // builds with the one the spec describes, and names it from the link
    createPluginManager: launchSnapshot,
  })
}

export async function createPluginManager(
  configSnapshot: JBrowseConfigInput,
  initialTimestamp = Date.now(),
) {
  // Global plugins load in every session, so they join the config's own list
  // before the loader runs. The config's entry wins a name/url collision (it is
  // version-pinned to what this session was built against), which is what
  // dedupePlugins keeping the first occurrence means here.
  const { plugins: globalPlugins, readError } = await getGlobalPlugins()
  try {
    return await buildSession(
      configSnapshot,
      globalPlugins,
      readError,
      initialTimestamp,
    )
  } finally {
    // after configure() and the session's own model creation, which is where a
    // plugin's menu registration or MST hooks run — a crash there is as much a
    // crash as one during module evaluation, and a caught throw is a renderer
    // that lived to report it
    markGlobalPluginLoadFinished()
  }
}

async function buildSession(
  configSnapshot: JBrowseConfigInput,
  globalPlugins: PluginDefinition[],
  readError: unknown,
  initialTimestamp: number,
) {
  const merged = dedupePlugins([
    ...(configSnapshot.plugins ?? []),
    ...globalPlugins,
  ])
  // which entries the global list, rather than the config, is responsible for.
  // Identity works here (dedupePlugins keeps the objects it was given) but not
  // downstream: PluginLoader deep-clones its definitions, so the loaded records
  // are matched back by samePlugin below. A global plugin the config also
  // declares isn't in here — dedupe kept the config's own entry, which the
  // session can remove for itself.
  const globalOnly = merged.filter(d => globalPlugins.includes(d))
  // failures are reported below, once there is a session to report them on
  const { pluginManager, failures: pluginLoadFailures } =
    await buildPluginManager(merged, d =>
      globalOnly.some(g => samePlugin(g, d)),
    )

  const JBrowseRootModel = JBrowseRootModelFactory({
    pluginManager,
    sessionModelFactory,
  })

  const jbrowse = completeConfig(configSnapshot)

  const rootModel = JBrowseRootModel.create({ jbrowse }, { pluginManager })

  pluginManager.setRootModel(rootModel)
  pluginManager.configure()

  // once per app launch, not per session opened: doAnalytics owns the
  // disableAnalytics check, the idle deferral, and the send-once guard that
  // keeps repeat session opens from appending another GA <script> to <head>
  doAnalytics(rootModel, initialTimestamp, undefined)

  // Set the session preserving its existing name rather than calling
  // setDefaultSession(), which re-appends a fresh timestamp every load and made
  // names grow without bound (doubled on first launch, then one extra timestamp
  // per reopen). See resolveSessionName.
  const defaultSession = rootModel.jbrowse.defaultSession as {
    name?: string
  } & Record<string, unknown>
  await pluginManager.preloadSessionTypes(defaultSession)
  rootModel.setSession({
    ...defaultSession,
    name: resolveSessionName(defaultSession),
  })

  for (const { definition, error } of pluginLoadFailures) {
    console.error(error)
    rootModel.session?.notifyError(
      `Failed to load ${pluginDescriptionString(definition)} from ${pluginUrl(definition)}. The session is open without it, so tracks or views that need it are unavailable.`,
      error,
    )
  }
  if (readError) {
    rootModel.session?.notifyError(globalPluginReadErrorMessage, readError)
  }

  return pluginManager
}
