import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function VcfAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'VcfAdapter',
        displayName: 'VCF adapter',
        configSchema,
        adapterCapabilities: ['exportData'],
        getAdapterClass: () => import('./VcfAdapter.ts').then(r => r.default),
      }),
  )
}
