import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export { default as configSchema } from './configSchema.ts'

export default function VcfTabixAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'SplitVcfTabixAdapter',
        displayName: 'VCF tabix adapter (split across multiple files)',
        configSchema,
        getAdapterClass: () =>
          import('./SplitVcfTabixAdapter.ts').then(r => r.default),
      }),
  )
}
