import { AdapterType } from '@jbrowse/core/pluggableElementTypes'
import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function Gff3AdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'Gff3Adapter',
        displayName: 'GFF3 adapter',
        configSchema,
        getAdapterClass: () => import('./Gff3Adapter').then(r => r.default),
      }),
  )
}
