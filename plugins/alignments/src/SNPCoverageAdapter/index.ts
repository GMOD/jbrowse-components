import PluginManager from '@jbrowse/core/PluginManager'
import AdapterClassF from './SNPCoverageAdapter'
import configSchemaF from './configSchema'

export default (pm: PluginManager) => {
  return {
    AdapterClass: AdapterClassF(pm),
    configSchema: configSchemaF(pm),
  }
}
