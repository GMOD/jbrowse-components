import PluginLoader from '@jbrowse/core/PluginLoader'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  dedupePlugins,
  dropVendoredPlugins,
  pluginDefinitionMetadata,
  pluginDescriptionString,
  pluginUrl,
  samePlugin,
} from '@jbrowse/core/pluginDefinitions'
import { dedupe } from '@jbrowse/core/util'
import { doAnalytics } from '@jbrowse/core/util/analytics'
import { destroy, isAlive } from '@jbrowse/mobx-state-tree'
import deepmerge from 'deepmerge'

import corePlugins from '../../corePlugins.ts'
import JBrowseRootModelFactory from '../../rootModel/rootModel.ts'
import sessionModelFactory from '../../sessionModel/sessionModel.ts'
import { fetchCJS } from '../../util.tsx'
import { DESKTOP_VENDORED } from '../../vendoredPlugins.ts'
import { fetchConfig } from './fetchConfig.ts'
import {
  getGlobalPlugins,
  markGlobalPluginLoadSucceeded,
} from './globalPlugins.ts'
import { launchFromLink } from './launchFromLink.ts'
import { newSessionName, resolveSessionName } from './sessionName.ts'

import type { DesktopRootModel } from '../../rootModel/rootModel.ts'
import type { JBrowseConfig } from './types.ts'
import type {
  PluginLoadFailure,
  PluginRecord,
} from '@jbrowse/core/PluginLoader'
import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'

export { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'
// re-exported so callers (e.g. LeftSidePanel) keep one import site
export { fetchConfig } from './fetchConfig.ts'

const { ipcRenderer } = window.require('electron')

function makePluginLoader(definitions: PluginDefinition[]) {
  return new PluginLoader(dropVendoredPlugins(definitions, DESKTOP_VENDORED), {
    fetchESM: url => import(/* webpackIgnore:true */ url),
    fetchCJS,
  }).installGlobalReExports(window)
}

function pluginRecords(
  runtimePlugins: PluginRecord[],
  isGlobal: (definition: PluginDefinition) => boolean,
) {
  return [
    ...corePlugins.map(P => ({
      plugin: new P(),
      metadata: {
        isCore: true,
      },
    })),
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
}

// A manager built from the global plugins alone, so the start screen — which
// has no session, and therefore no session plugin manager — can still fire the
// extension points a global plugin contributes to.
export async function createStartScreenPluginManager(): Promise<StartScreenPluginManager> {
  const pluginLoader = makePluginLoader(await getGlobalPlugins())
  // settled for the same reason the session loader is: one unloadable global
  // plugin must not cost the user their start screen
  const { records, failures } = await pluginLoader.loadSettled(
    window.location.href,
  )
  const pluginManager = new PluginManager(pluginRecords(records, () => true))
  pluginManager.createPluggableElements()
  // no root model to configure against, which every plugin's configure()
  // already guards for (isAbstractMenuManager), but extension points a plugin
  // registers there have to be in place before the start screen renders
  pluginManager.configure()
  // whatever the global plugins were going to do to this launch, they have now
  // done it, so the next one need not suspect them
  markGlobalPluginLoadSucceeded()
  return { pluginManager, failures }
}

export async function loadPluginManager(configPath: string) {
  const snap = await ipcRenderer.invoke('loadSession', configPath)
  const pm = await createPluginManager(snap)
  ;(pm.rootModel as DesktopRootModel | undefined)?.setSessionPath(configPath)
  return pm
}

/**
 * Open a JBrowse Web link as a new session. Shared by the File → Session → "Open
 * JBrowse Web link..." dialog and by a jbrowse:// link the main process
 * forwarded as ?specLink=, so both routes build the session identically.
 */
export async function openSpecLink(link: string) {
  return launchFromLink(link, {
    fetchConfig,
    createPluginManager: async config =>
      loadPluginManager(
        await ipcRenderer.invoke('createInitialAutosaveFile', {
          ...config,
          // a placeholder: loadSessionSpec replaces this session with the one
          // the spec describes (and names it)
          defaultSession: { name: newSessionName() },
        }),
      ),
  })
}

// Tear down a plugin manager that is being replaced: terminate its RPC worker
// threads and destroy the root model so its autorun disposers (e.g. autosave)
// fire. Without this, every session switch / plugin reload orphans the previous
// worker pool and leaves a live autosave loop holding the old tree.
export function destroyPluginManager(pluginManager: PluginManager) {
  const rootModel = pluginManager.rootModel as DesktopRootModel | undefined
  if (rootModel && isAlive(rootModel)) {
    rootModel.rpcManager.destroy()
    destroy(rootModel)
  }
}

export async function createPluginManager(
  configSnapshot: JBrowseConfig,
  initialTimestamp = Date.now(),
) {
  // Global plugins load in every session, so they join the config's own list
  // before the loader runs. The config's entry wins a name/url collision (it is
  // version-pinned to what this session was built against), which is what
  // dedupePlugins keeping the first occurrence means here.
  const globalPlugins = await getGlobalPlugins()
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
  const pluginLoader = makePluginLoader(merged)
  // Settled, not all-or-nothing: Desktop opens remote hub configs whose plugin
  // urls it has no control over, and one that 404s or needs a newer host than
  // this install used to leave the user with a dead app instead of a session
  // missing one feature. Reported below, once there is a session to report on.
  const { records: runtimePlugins, failures: pluginLoadFailures } =
    await pluginLoader.loadSettled(window.location.href)
  const pluginManager = new PluginManager(
    pluginRecords(runtimePlugins, d => globalOnly.some(g => samePlugin(g, d))),
  )
  pluginManager.createPluggableElements()
  markGlobalPluginLoadSucceeded()

  const JBrowseRootModel = JBrowseRootModelFactory({
    pluginManager,
    sessionModelFactory,
  })

  const jbrowse = deepmerge(configSnapshot, {
    internetAccounts: [
      {
        type: 'DropboxOAuthInternetAccount',
        internetAccountId: 'dropboxOAuth',
        name: 'Dropbox',
        description: 'Account to access Dropbox files',
        clientId: 'ykjqg1kr23pl1i7',
      },
      {
        type: 'GoogleDriveOAuthInternetAccount',
        internetAccountId: 'googleOAuth',
        name: 'Google Drive',
        description: 'Account to access Google Drive files',
        clientId:
          '109518325434-m86s8a5og8ijc5m6n7n8dk7e9586bg9i.apps.googleusercontent.com',
      },
    ],
    assemblies: [],
    tracks: [],
  }) as JBrowseConfig

  jbrowse.assemblies = dedupe(jbrowse.assemblies, asm => asm.name)
  jbrowse.tracks = dedupe(jbrowse.tracks, acct => acct.trackId)
  jbrowse.internetAccounts = dedupe(
    jbrowse.internetAccounts,
    acct => acct.internetAccountId,
  )

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

  return pluginManager
}
