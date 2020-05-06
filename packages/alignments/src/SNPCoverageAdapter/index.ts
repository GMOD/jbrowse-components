import PluginManager from '@gmod/jbrowse-core/PluginManager'
import AdapterClassF from './SNPCoverageAdapter'
import configSchemaF from './configSchema'

export default (pm: PluginManager) => {
  return {
    AdapterClass: AdapterClassF(pm),
    configSchema: configSchemaF(pm),
  }
}
