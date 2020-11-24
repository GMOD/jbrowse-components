// import PluginManager from '@jbrowse/core/PluginManager'
import configSchema from './configSchema'
import AdapterClass from './BamAdapter'

export default (/* pluginManager: PluginManager */) => {
  return {
    configSchema,
    AdapterClass,
  }
}
