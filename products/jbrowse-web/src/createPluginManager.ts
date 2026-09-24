import {
  loadSessionSpec,
  preloadAppFrame,
  preloadAppShell,
} from '@jbrowse/app-core'
import PluginManager, { corePluginRecords } from '@jbrowse/core/PluginManager'
import {
  pluginDefinitionMetadata,
  pluginDescriptionString,
  pluginUrl,
} from '@jbrowse/core/pluginDefinitions'
import { doAnalytics } from '@jbrowse/core/util/analytics'

import { applyDefaultSessionViewInit } from './applyDefaultSessionViewInit.ts'
import corePlugins from './corePlugins.ts'
import { loadHubSpec } from './loadHubSpec.ts'
import {
  markPermanentPluginLoadFinished,
  permanentPluginSafeMode,
  permanentPluginSafeModeSuspects,
  readPermanentPlugins,
} from './permanentPlugins.ts'
import { discardPrewarmedWorker } from './prewarmedWorker.ts'
import JBrowseRootModelFactory from './rootModel/rootModel.ts'
import sessionModelFactory from './sessionModel/index.ts'

import type { WebRootModel } from './rootModel/rootModel.ts'
import type { SessionSource } from './types.ts'
import type {
  PluginLoadFailure,
  PluginRecord,
} from '@jbrowse/core/PluginLoader'
import type { InitState } from '@jbrowse/plugin-linear-genome-view'

// Structural read-only view of SessionLoader. Kept narrow so it can be
// satisfied both by an Instance<SessionLoader> and by `self` inside an MST
// action chain (which doesn't yet expose the full action set).
export interface PluginManagerSource {
  readonly runtimePlugins?: readonly PluginRecord[]
  readonly sessionPlugins?: readonly PluginRecord[]
  readonly pluginLoadFailures?: readonly PluginLoadFailure[]
  readonly configSnapshot?: Record<string, unknown>
  readonly configPath?: string
  readonly adminKey?: string
  readonly sessionSource?: SessionSource
  readonly sessionName?: string
  readonly initialTimestamp: number
  readonly sessionQuery?: string
  // the URL-param subset of the LGV launch spec; derived from InitState rather
  // than restated so a new field can't go missing on the way through
  readonly defaultSessionViewInit?: Partial<InitState>
}

function asPluginRecord({ plugin: P, definition }: PluginRecord) {
  return {
    plugin: new P(),
    definition,
    metadata: pluginDefinitionMetadata(definition),
  }
}

function formatSessionError(e: unknown) {
  const m = `${e}`
    .replace('[@jbrowse/mobx-state-tree] ', '')
    .replace(/\(.+/, '')
  const r = m.length > 1000 ? `${m.slice(0, 1000)}...see more in console` : m
  return r.startsWith('Error:') ? r : `Error: ${r}`
}

export async function createPluginManager(
  model: PluginManagerSource,
  reloadPluginManagerCallback: (
    configSnapshot: Record<string, unknown>,
    sessionSnapshot: Record<string, unknown>,
  ) => void,
) {
  const pluginManager = new PluginManager([
    ...corePluginRecords(corePlugins),
    ...(model.runtimePlugins ?? []).map(asPluginRecord),
    ...(model.sessionPlugins ?? []).map(asPluginRecord),
  ]).createPluggableElements()

  const rootModel = JBrowseRootModelFactory({
    pluginManager,
    sessionModelFactory,
    adminMode: !!model.adminKey,
  }).create(
    {
      jbrowse: model.configSnapshot,
      configPath: model.configPath,
    },
    { pluginManager },
  )
  rootModel.setReloadPluginManagerCallback(reloadPluginManagerCallback)

  // configure() before initSession so hub/spec sessions see registered
  // views/tracks/extension-points; safe because configure() doesn't read
  // session state
  pluginManager.setRootModel(rootModel).configure()
  const appFrame = preloadAppFrame()
  preloadSessionAssemblies(rootModel, model)
  // the plugin list the worker gets is the trusted one, which exists from here
  if (rootModel.rpcManager.driverName === 'WebWorkerRpcDriver') {
    rootModel.rpcManager.warmUp()
  } else {
    discardPrewarmedWorker()
  }
  doAnalytics(rootModel, model.initialTimestamp, model.sessionQuery)
  // both: the config's default session is initSession's fallback on any
  // failure
  if (model.sessionSource?.type === 'snapshot') {
    await pluginManager.preloadSessionTypes(model.sessionSource.snapshot)
  }
  await pluginManager.preloadSessionTypes(model.configSnapshot?.defaultSession)
  await nextTask()
  initSession(rootModel, pluginManager, model)
  if (rootModel.session) {
    preloadAppShell(rootModel.session)
  }
  notifyPluginLoadFailures(rootModel, model)
  notifyPermanentPluginSafeMode(rootModel)
  // Here rather than beside the PluginManager above, so the window the crash
  // marker covers includes `configure()` — where a plugin registers its menu
  // items and extension points, and where one that throws takes the app down
  // just as thoroughly as one that throws while its module is evaluated.
  markPermanentPluginLoadFinished()
  await appFrame
  await nextTask()
  return pluginManager
}

/**
 * Building the session and rendering the app are each one long task. A chunk
 * that landed meanwhile runs, and starts what waited on it (an assembly's file
 * fetch), only between tasks.
 */
function nextTask() {
  return new Promise(resolve => {
    setTimeout(resolve, 0)
  })
}

function assemblyNamesIn(value: unknown, found = new Set<string>()) {
  if (typeof value === 'object' && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      if (
        (key === 'assembly' || key === 'assemblyName') &&
        typeof child === 'string'
      ) {
        found.add(child)
      } else if (key === 'assemblyNames' && Array.isArray(child)) {
        for (const name of child) {
          if (typeof name === 'string') {
            found.add(name)
          }
        }
      } else {
        assemblyNamesIn(child, found)
      }
    }
  }
  return found
}

/**
 * Start loading the assemblies the session about to open names, so their
 * chromosome lists download beside the session's view and display code rather
 * than after its view exists. A hub session brings its own assemblies.
 */
function preloadSessionAssemblies(
  rootModel: WebRootModel,
  {
    sessionSource,
    configSnapshot,
    defaultSessionViewInit,
  }: PluginManagerSource,
) {
  const viewsOf = (snapshot: unknown) =>
    typeof snapshot === 'object' && snapshot !== null && 'views' in snapshot
      ? snapshot.views
      : undefined
  const source =
    sessionSource?.type === 'snapshot'
      ? viewsOf(sessionSource.snapshot)
      : sessionSource?.type === 'spec'
        ? viewsOf(sessionSource.spec)
        : sessionSource?.type === 'hub'
          ? undefined
          : defaultSessionViewInit?.assembly
            ? defaultSessionViewInit
            : viewsOf(configSnapshot?.defaultSession)
  const { assemblyManager } = rootModel
  for (const name of assemblyNamesIn(source)) {
    if (assemblyManager.has(name)) {
      assemblyManager.waitForAssembly(name).catch(() => {})
    }
  }
}

// Safe mode is silent otherwise: the app comes up looking normal, missing
// whatever those plugins provide. Said on the session because that is the one
// surface that exists by now — the fatal error dialog, which is where safe mode
// is usually entered from, is by definition not on screen if we got this far.
//
// Said for both reasons. `?safeMode` sticks to the url across reloads, so a
// user who asked for it once, or was handed a link carrying it, would otherwise
// be missing their plugins on every visit with nothing on screen saying why.
// Only when there is a list being skipped: an empty one is a no-op, not news.
function notifyPermanentPluginSafeMode(rootModel: WebRootModel) {
  const reason = permanentPluginSafeMode()
  if (!reason || !readPermanentPlugins().some(p => !p.disabled)) {
    return
  }
  const suspects = permanentPluginSafeModeSuspects()
  rootModel.session?.notify(
    [
      reason === 'previousLaunchFailed'
        ? 'Permanently installed plugins were skipped because the last load of this JBrowse did not finish.'
        : 'Permanently installed plugins were skipped because this URL asks for safe mode.',
      suspects.length ? `Loading: ${suspects.join(', ')}.` : '',
      'Tools → Plugin store to switch one off or turn them back on.',
    ]
      .filter(Boolean)
      .join(' '),
    'warning',
  )
}

// A plugin a config named but that couldn't be loaded no longer fails the app
// (PluginLoader.loadSettled), so it has to be said out loud here instead: the
// session is open and usable, but anything that plugin provided — a view type, a
// track type, an adapter — is missing, and a track that needed it will fail on
// its own with a much less obvious message. Reported after initSession, since
// there is no session to notify on before it.
function notifyPluginLoadFailures(
  rootModel: WebRootModel,
  model: PluginManagerSource,
) {
  for (const { definition, error } of model.pluginLoadFailures ?? []) {
    console.error(error)
    rootModel.session?.notifyError(
      `Failed to load ${pluginDescriptionString(definition)} from ${pluginUrl(definition)}. The session is open without it, so tracks or views that need it are unavailable.`,
      error,
    )
  }
}

// Applies the single session the loader resolved. The loader already
// discriminated which kind of session this is; here we just dispatch on
// sessionSource.type. Any failure (a resolved error, or a thrown snapshot)
// falls back to the default session with a user-facing notification.
function initSession(
  rootModel: WebRootModel,
  pluginManager: PluginManager,
  model: PluginManagerSource,
) {
  const { sessionSource, sessionName, defaultSessionViewInit } = model
  try {
    if (sessionSource?.type === 'error') {
      throw sessionSource.error
    } else if (sessionSource?.type === 'snapshot') {
      rootModel.setSession(sessionSource.snapshot)
    } else if (sessionSource?.type === 'hub') {
      void loadHubSpec(
        {
          ...sessionSource.hubSpec,
          sessionName,
          viewInit: sessionSource.viewInit,
          sessionTracks: sessionSource.sessionTracks,
        },
        pluginManager,
      )
    } else if (sessionSource?.type === 'spec') {
      void loadSessionSpec(
        // @ts-expect-error spec is dynamic JSON (Record<string,unknown>); the
        // required shape is validated at runtime inside loadSessionSpec
        sessionName
          ? { ...sessionSource.spec, sessionName }
          : sessionSource.spec,
        pluginManager,
      )
    } else {
      rootModel.setDefaultSession()
      if (defaultSessionViewInit) {
        applyDefaultSessionViewInit(rootModel.session, defaultSessionViewInit)
      }
      if (sessionName) {
        rootModel.renameCurrentSession(sessionName)
      }
    }
  } catch (e) {
    rootModel.setDefaultSession()
    rootModel.session?.notifyError(
      `${formatSessionError(e)}. If you received this URL from another user, request that they send you a session generated with the "Share" button instead of copying and pasting their URL`,
      e,
      sessionSource?.type === 'snapshot' ? sessionSource.snapshot : undefined,
    )
    console.error(e)
  }
}
