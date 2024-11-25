import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function PairwiseIndexedPAFAdapterF(
  pluginManager: PluginManager,
) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'PairwiseIndexedPAFAdapter',
        displayName: 'Pairwise indexed PAF adapter',
        configSchema,
        adapterMetadata: {
          hiddenFromGUI: true,
        },
        getAdapterClass: () =>
          import('./PairwiseIndexedPAFAdapter').then(r => r.default),
      }),
  )
}
