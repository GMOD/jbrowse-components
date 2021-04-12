import PluginManager from '@jbrowse/core/PluginManager'
import configSchemaF from './configSchema'
import { capabilities } from './SNPCoverageAdapter'

export default (pm: PluginManager) => {
  return {
    getAdapterClass: () => import('./SNPCoverageAdapter'),
    configSchema: configSchemaF(pm),
    adapterCapabilities: capabilities,
  }
}
