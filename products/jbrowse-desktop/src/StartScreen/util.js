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
  rootModel.jbrowse.configuration.rpc.addDriverConfig('WebWorkerRpcDriver', {
    type: 'WebWorkerRpcDriver',
  })
  rootModel.jbrowse.configuration.rpc.defaultDriver.set('WebWorkerRpcDriver')
  // make some things available globally for testing
  // e.g. window.MODEL.views[0] in devtools
  // @ts-ignore
  window.MODEL = rootModel.session
  // @ts-ignore
  window.ROOTMODEL = rootModel
  pm.setRootModel(rootModel)

  pm.configure()

  if (
    rootModel &&
    !readConfObject(rootModel.jbrowse.configuration, 'disableAnalytics')
  ) {
    writeAWSAnalytics(rootModel, initialTimestamp)
    writeGAAnalytics(rootModel, initialTimestamp)
  }
}
