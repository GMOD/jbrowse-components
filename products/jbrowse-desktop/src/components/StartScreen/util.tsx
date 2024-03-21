import PluginManager from '@jbrowse/core/PluginManager'
import PluginLoader from '@jbrowse/core/PluginLoader'
import { readConfObject } from '@jbrowse/core/configuration'
import deepmerge from 'deepmerge'

import {
  writeAWSAnalytics,
  writeGAAnalytics,
} from '@jbrowse/core/util/analytics'

// locals
import JBrowseRootModelFactory from '../../rootModel'
import corePlugins from '../../corePlugins'
import sessionModelFactory from '../../sessionModel'
import { fetchCJS } from '../../util'

const { ipcRenderer } = window.require('electron')

function uniqBy<T>(a: T[], key: (arg: T) => string) {
  const seen = new Set()
  return a.filter(item => {
    const k = key(item)
    return seen.has(k) ? false : seen.add(k)
  })
}

const defaultInternetAccounts = [
  {
    clientId: 'ykjqg1kr23pl1i7',
    description: 'Account to access Dropbox files',
    internetAccountId: 'dropboxOAuth',
    name: 'Dropbox',
    type: 'DropboxOAuthInternetAccount',
  },
  {
    clientId:
      '109518325434-m86s8a5og8ijc5m6n7n8dk7e9586bg9i.apps.googleusercontent.com',
    description: 'Account to access Google Drive files',
    internetAccountId: 'googleOAuth',
    name: 'Google Drive',
    type: 'GoogleDriveOAuthInternetAccount',
  },
]

export async function loadPluginManager(configPath: string) {
  const snap = await ipcRenderer.invoke('loadSession', configPath)
  const pm = await createPluginManager(snap)
  // @ts-expect-error
  pm.rootModel?.setSessionPath(configPath)
  return pm
}

export async function createPluginManager(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configSnapshot: any,
  initialTimestamp = +Date.now(),
) {
  const pluginLoader = new PluginLoader(configSnapshot.plugins, {
    fetchCJS,
    fetchESM: url => import(/* webpackIgnore:true */ url),
  })
  pluginLoader.installGlobalReExports(window)
  const runtimePlugins = await pluginLoader.load(window.location.href)
  const pluginManager = new PluginManager([
    ...corePlugins.map(P => ({
      metadata: { isCore: true },
      plugin: new P(),
    })),
    ...runtimePlugins.map(({ plugin: P, definition }) => ({
      definition,
      metadata: {
        cjsUrl: definition.cjsUrl,
        esmUrl: definition.esmUrl,
        umdUrl: definition.umdUrl,
        url: definition.url,
      },
      plugin: new P(),
    })),
  ])
  pluginManager.createPluggableElements()

  const JBrowseRootModel = JBrowseRootModelFactory({
    pluginManager,
    sessionModelFactory,
  })

  const jbrowse = deepmerge(configSnapshot, {
    assemblies: [],
    internetAccounts: defaultInternetAccounts,
    tracks: [],
  }) as {
    internetAccounts: { internetAccountId: string }[]
    assemblies: { name: string }[]
    tracks: { trackId: string }[]
  }

  jbrowse.assemblies = uniqBy(jbrowse.assemblies, asm => asm.name)
  jbrowse.tracks = uniqBy(jbrowse.tracks, acct => acct.trackId)
  jbrowse.internetAccounts = uniqBy(
    jbrowse.internetAccounts,
    acct => acct.internetAccountId,
  )

  const rootModel = JBrowseRootModel.create({ jbrowse }, { pluginManager })
  const config = rootModel.jbrowse.configuration
  const { rpc } = config
  rpc.defaultDriver.set('WebWorkerRpcDriver')

  pluginManager.setRootModel(rootModel)
  pluginManager.configure()

  if (rootModel && !readConfObject(config, 'disableAnalytics')) {
    // these are ok if they are uncaught promises
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    writeAWSAnalytics(rootModel, initialTimestamp)
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    writeGAAnalytics(rootModel, initialTimestamp)
  }

  rootModel.setDefaultSession()

  return pluginManager
}

export interface RecentSessionData {
  path: string
  name: string
  screenshot?: string
  updated?: number
}
