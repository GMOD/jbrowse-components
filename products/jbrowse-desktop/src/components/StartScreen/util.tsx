import PluginLoader from '@jbrowse/core/PluginLoader'
import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'
import { dedupe } from '@jbrowse/core/util'
import {
  writeAWSAnalytics,
  writeGAAnalytics,
} from '@jbrowse/core/util/analytics'
import deepmerge from 'deepmerge'

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
