import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export { default as configSchema } from './configSchema'

export default function VcfTabixAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'SplitVcfTabixAdapter',
        displayName: 'VCF tabix adapter (split across multiple files)',
        configSchema,
        getAdapterClass: () =>
          import('./SplitVcfTabixAdapter').then(r => r.default),
      }),
  )
}
