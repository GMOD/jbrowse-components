import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MCScanSimpleAnchorsAdapterF(
  pluginManager: PluginManager,
) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'MCScanSimpleAnchorsAdapter',
        displayName: 'MCScan anchors.simple adapter',
        configSchema,
        adapterMetadata: {
          category: 'Synteny adapters',
        },
        getAdapterClass: () =>
          import('./MCScanSimpleAnchorsAdapter.ts').then(r => r.default),
      }),
  )
}
