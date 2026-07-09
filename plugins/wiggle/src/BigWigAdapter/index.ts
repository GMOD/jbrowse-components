import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema, { normalizeSnapshot } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function BigWigAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'BigWigAdapter',
        displayName: 'BigWig adapter',
        normalizeSnapshot,
        configSchema,
        adapterCapabilities: ['hasResolution', 'hasLocalStats'],
        getAdapterClass: () =>
          import('./BigWigAdapter.ts').then(r => r.default),
      }),
  )
}
