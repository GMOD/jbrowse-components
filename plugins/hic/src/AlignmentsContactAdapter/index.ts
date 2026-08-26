import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function AlignmentsContactAdapterF(
  pluginManager: PluginManager,
) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'AlignmentsContactAdapter',
        displayName: 'Alignments contact map adapter',
        configSchema,
        getAdapterClass: () =>
          import('./AlignmentsContactAdapter.ts').then(r => r.default),
      }),
  )
}
