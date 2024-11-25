import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function BlastTabularAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'BlastTabularAdapter',
        displayName: 'Tabular BLAST output adapter',
        configSchema,
        adapterMetadata: {
          hiddenFromGUI: true,
        },
        getAdapterClass: () =>
          import('./BlastTabularAdapter').then(r => r.default),
      }),
  )
}
