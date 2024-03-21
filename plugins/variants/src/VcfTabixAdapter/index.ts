import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import configSchema from './configSchema'

export { default as configSchema } from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        configSchema,
        displayName: 'VCF tabix adapter',
        getAdapterClass: () => import('./VcfTabixAdapter').then(r => r.default),
        name: 'VcfTabixAdapter',
      }),
  )
}
