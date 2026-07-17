import PluginLoader, { dropVendoredPlugins } from '@jbrowse/core/PluginLoader'
import PluginManager from '@jbrowse/core/PluginManager'
import { checkPlugins } from '@jbrowse/core/checkPlugins'
import { readConfObject } from '@jbrowse/core/configuration'
import { dedupe, fetchJson } from '@jbrowse/core/util'
import {
  writeAWSAnalytics,
  writeGAAnalytics,
} from '@jbrowse/core/util/analytics'
import { destroy, isAlive } from '@jbrowse/mobx-state-tree'
import { addRelativeUris } from '@jbrowse/product-core'
import deepmerge from 'deepmerge'

import { assertPluginsTrusted } from './assertPluginsTrusted.ts'
import { launchFromLink } from './launchFromLink.ts'
import { newSessionName, resolveSessionName } from './sessionName.ts'
import corePlugins from '../../corePlugins.ts'
import JBrowseRootModelFactory from '../../rootModel/rootModel.ts'
import sessionModelFactory from '../../sessionModel/sessionModel.ts'
import { fetchCJS } from '../../util.tsx'

import type { JBrowseConfig } from './types.ts'
import type { DesktopRootModel } from '../../rootModel/rootModel.ts'

export { addRelativeUris } from '@jbrowse/product-core'

const { ipcRenderer } = window.require('electron')

export async function loadPluginManager(configPath: string) {
  const snap = await ipcRenderer.invoke('loadSession', configPath)
  const pm = await createPluginManager(snap)
  ;(pm.rootModel as DesktopRootModel | undefined)?.setSessionPath(configPath)
  return pm
}

// Fetch one remote config and make it loadable here: rebase its relative uris
// on where it was served from, and record that url so "export to web" can reuse
// it as the session base (?config=<sourceConfigUrl>).
export async function fetchConfig(url: string) {
  const ret = await fetchJson(url)
  addRelativeUris(ret as Record<string, unknown>, new URL(url))
  const cfg = ret as JBrowseConfig
  cfg.configuration = {
    ...cfg.configuration,
    sourceConfigUrl: url,
  }
  return cfg
}

/**
 * Open a JBrowse Web link as a new session. Shared by the File → Session → "Open
 * JBrowse Web link..." dialog and by a jbrowse:// link the main process
 * forwarded as ?specLink=, so both routes build the session identically.
 *
 * The config behind the link is remote and attacker-supplied in the worst case
 * (any web page can make the OS hand us a jbrowse:// link), so its plugins are
 * vetted before it is written to disk or handed to PluginLoader — see
 * assertPluginsTrusted.
 */
export async function openSpecLink(link: string) {
  return launchFromLink(link, {
    fetchConfig: async url => {
      const config = await fetchConfig(url)
      await assertPluginsTrusted(config.plugins, {
        checkPlugins,
        confirm: plugins =>
          ipcRenderer.invoke('confirmUntrustedPlugins', plugins),
      })
      return config
    },
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
  const pluginLoader = new PluginLoader(
    dropVendoredPlugins(configSnapshot.plugins ?? []),
    {
      fetchESM: url => import(/* webpackIgnore:true */ url),
      fetchCJS,
    },
  )
  pluginLoader.installGlobalReExports(window)
  const runtimePlugins = await pluginLoader.load(window.location.href)
  const pluginManager = new PluginManager([
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
        url: 'url' in definition ? definition.url : undefined,
        esmUrl: 'esmUrl' in definition ? definition.esmUrl : undefined,
        umdUrl: 'umdUrl' in definition ? definition.umdUrl : undefined,
        cjsUrl: 'cjsUrl' in definition ? definition.cjsUrl : undefined,
      },
    })),
  ])
  pluginManager.createPluggableElements()

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
  const config = rootModel.jbrowse.configuration

  pluginManager.setRootModel(rootModel)
  pluginManager.configure()

  if (!readConfObject(config, 'disableAnalytics')) {
    // these are ok if they are uncaught promises
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    writeAWSAnalytics(rootModel, initialTimestamp)
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    writeGAAnalytics(rootModel, initialTimestamp)
  }

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

  return pluginManager
}
