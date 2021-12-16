import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

// locals
import configSchemaF from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'CramAdapter',
        configSchema: pluginManager.load(configSchemaF),
        getAdapterClass: () => import('./CramAdapter').then(r => r.default),
      }),
  )
}
