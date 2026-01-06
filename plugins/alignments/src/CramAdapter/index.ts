import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function CramAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(() => {
    return new AdapterType({
      name: 'CramAdapter',
      displayName: 'CRAM adapter',
      configSchema,
      getAdapterClass: () => import('./CramAdapter.ts').then(r => r.default),
    })
  })
}
