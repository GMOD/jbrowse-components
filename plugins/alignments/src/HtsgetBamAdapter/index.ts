// import PluginManager from '@jbrowse/core/PluginManager'
import configSchema from './configSchema'
import AdapterClass from './HtsgetBamAdapter'

export default (/* pluginManager: PluginManager */) => {
  return {
    configSchema,
    AdapterClass,
  }
}
