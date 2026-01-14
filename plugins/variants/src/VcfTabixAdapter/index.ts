import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export { default as configSchema } from './configSchema.ts'

export default function VcfTabixAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'VcfTabixAdapter',
        displayName: 'VCF tabix adapter',
        configSchema,
        adapterCapabilities: ['exportData'],
        getAdapterClass: () =>
          import('./VcfTabixAdapter.ts').then(r => r.default),
      }),
  )
}
