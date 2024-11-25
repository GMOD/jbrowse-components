import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function VcfAdapterF(pluginManager: PluginManager) {
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
