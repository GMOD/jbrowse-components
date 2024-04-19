import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

// locals
import configSchema from './configSchema'

export default function CramAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(() => {
    return new AdapterType({
      name: 'CramAdapter',
      displayName: 'CRAM adapter',
      configSchema,
      getAdapterClass: () => import('./CramAdapter').then(r => r.default),
    })
  })
}
