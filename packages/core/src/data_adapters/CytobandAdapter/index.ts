import { AdapterType } from '../../pluggableElementTypes/index.ts'
import configSchema from './configSchema.ts'

import type PluginManager from '../../PluginManager.ts'

export default function CytobandAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'CytobandAdapter',
        configSchema,
        adapterMetadata: {
          hiddenFromGUI: true,
        },
        getAdapterClass: () =>
          import('./CytobandAdapter.ts').then(f => f.default),
      }),
  )
}
