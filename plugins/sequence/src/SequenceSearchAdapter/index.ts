import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function SequenceSearchAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'SequenceSearchAdapter',
        displayName: 'Sequence search adapter',
        adapterMetadata: {
          hiddenFromGUI: true,
        },
        configSchema,
        getAdapterClass: () =>
          import('./SequenceSearchAdapter').then(r => r.default),
      }),
  )
}
