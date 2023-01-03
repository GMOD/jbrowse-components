import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'VcfAdapter',
        displayName: 'VCF adapter',
        configSchema,
        getAdapterClass: () => import('./VcfAdapter').then(r => r.default),
      }),
  )
}
