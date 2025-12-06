import PluginLoader from '@jbrowse/core/PluginLoader'
import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'
import { dedupe } from '@jbrowse/core/util'
import {
  writeAWSAnalytics,
  writeGAAnalytics,
} from '@jbrowse/core/util/analytics'
import deepmerge from 'deepmerge'

import corePlugins from '../../corePlugins'
import JBrowseRootModelFactory from '../../rootModel/rootModel'
import { fetchCJS } from '../../util'

import type { JBrowseConfig } from './types'

const { ipcRenderer } = window.require('electron')

export async function loadPluginManager(configPath: string) {
  const snap = await ipcRenderer.invoke('loadSession', configPath)
  const pm = await createPluginManager(snap)
  // @ts-expect-error
  pm.rootModel?.setSessionPath(configPath)
  return pm
}

export async function createPluginManager(
  configSnapshot: JBrowseConfig,
  initialTimestamp = Date.now(),
) {
  const pluginLoader = new PluginLoader(configSnapshot.plugins, {
    fetchESM: url => import(/* webpackIgnore:true */ url),
    fetchCJS,
  })
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
        // @ts-expect-error
        url: definition.url,
        // @ts-expect-error
        esmUrl: definition.esmUrl,
        // @ts-expect-error
        umdUrl: definition.umdUrl,
        // @ts-expect-error
        cjsUrl: definition.cjsUrl,
      },
    })),
  ])
  pluginManager.createPluggableElements()

  const JBrowseRootModel = JBrowseRootModelFactory(pluginManager)

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
  const { rpc } = config
  rpc.defaultDriver.set('WebWorkerRpcDriver')

  pluginManager.setRootModel(rootModel)
  pluginManager.configure()

  if (!readConfObject(config, 'disableAnalytics')) {
    // these are ok if they are uncaught promises
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    writeAWSAnalytics(rootModel, initialTimestamp)
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    writeGAAnalytics(rootModel, initialTimestamp)
  }

  rootModel.setDefaultSession()

  return pluginManager
}

export async function fetchjson(url: string) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`)
  }
  return res.json() as Promise<unknown>
}

export function addRelativeUris(
  config: Record<string, unknown> | null,
  base: URL,
) {
  if (typeof config === 'object' && config !== null) {
    for (const key of Object.keys(config)) {
      if (typeof config[key] === 'object' && config[key] !== null) {
        addRelativeUris(config[key] as Record<string, unknown>, base)
      } else if (key === 'uri') {
        config.baseUri = base.href
      }
    }
  }
}
