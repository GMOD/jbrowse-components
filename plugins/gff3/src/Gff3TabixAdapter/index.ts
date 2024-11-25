import { AdapterType } from '@jbrowse/core/pluggableElementTypes'
import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function Gff3TabixAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'Gff3TabixAdapter',
        displayName: 'GFF3 tabix adapter',
        configSchema,
        getAdapterClass: () =>
          import('./Gff3TabixAdapter').then(r => r.default),
      }),
  )
}
