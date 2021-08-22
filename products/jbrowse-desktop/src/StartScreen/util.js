import PluginManager from '@jbrowse/core/PluginManager'
import PluginLoader from '@jbrowse/core/PluginLoader'
import { readConfObject } from '@jbrowse/core/configuration'

import JBrowseRootModelFactory from '../rootModel'
import corePlugins from '../corePlugins'
import { version } from '../../package.json'

import {
  writeAWSAnalytics,
  writeGAAnalytics,
} from '@jbrowse/core/util/analytics'

export async function createPluginManager(
  configSnapshot: any,
  initialTimestamp = +Date.now(),
) {
  const pluginLoader = new PluginLoader(configSnapshot.plugins)
  pluginLoader.installGlobalReExports(window)
  const runtimePlugins = await pluginLoader.load()
  const plugins = [
    ...corePlugins.map(P => ({
      plugin: new P(),
      metadata: { isCore: true },
    })),
    ...runtimePlugins.map(({ plugin: P, definition }) => ({
      plugin: new P(),
      definition,
      metadata: { url: definition.url },
    })),
  ]
  const pm = new PluginManager(plugins)
  pm.createPluggableElements()

  const JBrowseRootModel = JBrowseRootModelFactory(pm)
  const rootModel = JBrowseRootModel.create(
    {
      jbrowse: configSnapshot,
      assemblyManager: {},
      version,
    },
    { pluginManager: pm },
  )

  const config = rootModel.jbrowse.configuration
  const { rpc } = config

  rpc.addDriverConfig('WebWorkerRpcDriver', {
    type: 'WebWorkerRpcDriver',
  })
  rpc.defaultDriver.set('WebWorkerRpcDriver')

  pm.setRootModel(rootModel)
  pm.configure()

  if (rootModel && !readConfObject(config, 'disableAnalytics')) {
    writeAWSAnalytics(rootModel, initialTimestamp)
    writeGAAnalytics(rootModel, initialTimestamp)
  }

  rootModel.setDefaultSession()

  return pm
}
