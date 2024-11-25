import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function FromConfigSequenceAdapterF(
  pluginManager: PluginManager,
) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'FromConfigSequenceAdapter',
        configSchema,
        getAdapterClass: () =>
          import('./FromConfigSequenceAdapter').then(r => r.default),
        adapterMetadata: {
          hiddenFromGUI: true,
        },
      }),
  )
}
