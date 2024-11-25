import PluginLoader from '@jbrowse/core/PluginLoader'
import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'
import {
  writeAWSAnalytics,
  writeGAAnalytics,
} from '@jbrowse/core/util/analytics'
import deepmerge from 'deepmerge'

// locals
import corePlugins from '../../corePlugins'
import JBrowseRootModelFactory from '../../rootModel'
import sessionModelFactory from '../../sessionModel'
import { fetchCJS } from '../../util'
import type { PluginDefinition } from '@jbrowse/core/PluginLoader'

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
]

export async function loadPluginManager(configPath: string) {
  const snap = await ipcRenderer.invoke('loadSession', configPath)
  const pm = await createPluginManager(snap)
  // @ts-expect-error
  pm.rootModel?.setSessionPath(configPath)
  return pm
}

export async function createPluginManager(
  configSnapshot: {
    plugins?: PluginDefinition[]
  },
  initialTimestamp = +Date.now(),
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

  const JBrowseRootModel = JBrowseRootModelFactory({
    pluginManager,
    sessionModelFactory,
  })

  const jbrowse = deepmerge(configSnapshot, {
    internetAccounts: defaultInternetAccounts,
    assemblies: [],
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

export interface RecentSessionData {
  path: string
  name: string
  screenshot?: string
  updated?: number
}
