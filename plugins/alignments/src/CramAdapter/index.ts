import PluginManager from '@jbrowse/core/PluginManager'
import configSchemaF from './configSchema'
import AdapterF from './CramAdapter'

export default (pluginManager: PluginManager) => {
  return {
    configSchema: pluginManager.load(configSchemaF),
    AdapterClass: pluginManager.load(AdapterF),
  }
}
