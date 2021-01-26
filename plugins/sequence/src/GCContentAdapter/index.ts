import PluginManager from '@jbrowse/core/PluginManager'
import configSchemaF from './configSchema'
import AdapterClass from './GCContentAdapter'

export default (pluginManager: PluginManager) => {
  return {
    configSchema: pluginManager.load(configSchemaF),
    AdapterClass,
  }
}
