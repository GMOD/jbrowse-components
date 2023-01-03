import { AdapterType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
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
