import PluginManager from '@jbrowse/core/PluginManager'
import configSchemaFactory from './configSchema'
import { capabilities } from './SNPCoverageAdapter'

export default (pluginManager: PluginManager) => {
  return {
    getAdapterClass: () => import('./SNPCoverageAdapter').then(r => r.default),
    configSchema: configSchemaFactory(pluginManager),
    adapterCapabilities: capabilities,
  }
}
