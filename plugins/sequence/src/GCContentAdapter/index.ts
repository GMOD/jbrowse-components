import PluginManager from '@jbrowse/core/PluginManager'
import configSchemaF from './configSchema'

export default (pluginManager: PluginManager) => {
  return {
    configSchema: pluginManager.load(configSchemaF),
    getAdapterClass: () => import('./GCContentAdapter').then(r => r.default),
  }
}
