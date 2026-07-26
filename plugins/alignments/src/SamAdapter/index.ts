import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema, { normalizeSnapshot } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function SamAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(() => {
    return new AdapterType({
      name: 'SamAdapter',
      displayName: 'SAM adapter',
      normalizeSnapshot,
      configSchema,
      getAdapterClass: () => import('./SamAdapter.ts').then(r => r.default),
    })
  })
}
