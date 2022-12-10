import { AdapterType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
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
