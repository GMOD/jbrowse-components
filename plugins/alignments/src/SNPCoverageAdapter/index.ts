import PluginManager from '@jbrowse/core/PluginManager'
import configSchemaF from './configSchema'
import { capabilities } from './SNPCoverageAdapter'

export default (pm: PluginManager) => {
  return {
    getAdapterClass: () => import('./SNPCoverageAdapter').then(r => r.default),
    configSchema: configSchemaF(pm),
    adapterCapabilities: capabilities,
  }
}
