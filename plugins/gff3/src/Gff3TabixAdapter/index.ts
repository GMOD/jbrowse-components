import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import configSchema, { normalizeSnapshot } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function Gff3TabixAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'Gff3TabixAdapter',
        displayName: 'GFF3 tabix adapter',
        normalizeSnapshot,
        configSchema,
        getAdapterClass: () =>
          import('./Gff3TabixAdapter.ts').then(r => r.default),
      }),
  )
}
