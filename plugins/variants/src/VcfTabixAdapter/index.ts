import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import configSchema from './configSchema'

export { default as configSchema } from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'VcfTabixAdapter',
        displayName: 'VCF tabix adapter',
        configSchema,
        getAdapterClass: () => import('./VcfTabixAdapter').then(r => r.default),
      }),
  )
}
