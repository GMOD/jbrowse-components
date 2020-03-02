import PluginManager from '@gmod/jbrowse-core/PluginManager'
import configSchemaF from './configSchema'
import AdapterF from './CramAdapter'

export default (pluginManager: PluginManager) => {
  return {
    configSchema: pluginManager.load(configSchemaF),
    AdapterClass: AdapterF(pluginManager),
  }
}
