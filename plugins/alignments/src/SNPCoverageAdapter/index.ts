import PluginManager from '@jbrowse/core/PluginManager'
import AdapterClass from './SNPCoverageAdapter'
import configSchemaF from './configSchema'

export default (pm: PluginManager) => {
  return {
    AdapterClass,
    configSchema: configSchemaF(pm),
  }
}
