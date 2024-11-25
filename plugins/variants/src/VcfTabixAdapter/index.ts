import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export { default as configSchema } from './configSchema'

export default function VcfTabixAdapterF(pluginManager: PluginManager) {
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
