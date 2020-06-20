import PluginManager from '@gmod/jbrowse-core/PluginManager'
import configSchema from './configSchema'
import Adapter from './HicAdapter'

export default (pluginManager: PluginManager) => {
  return {
    configSchema,
    AdapterClass: Adapter,
  }
}
