import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema, { normalizeSnapshot } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function AllVsAllIndexedPAFAdapterF(
  pluginManager: PluginManager,
) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'AllVsAllIndexedPAFAdapter',
        displayName: 'All-vs-all indexed PAF adapter',
        normalizeSnapshot,
        configSchema,
        adapterCapabilities: ['lod'],
        adapterMetadata: {
          category: 'Synteny adapters',
        },
        getAdapterClass: () =>
          import('./AllVsAllIndexedPAFAdapter.ts').then(r => r.default),
      }),
  )
}
