import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function BamAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(() => {
    return new AdapterType({
      name: 'BamAdapter',
      displayName: 'BAM adapter',
      configSchema,
      getAdapterClass: () => import('./BamAdapter.ts').then(r => r.default),
    })
  })
}
