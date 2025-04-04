import configSchema from './configSchema'
import { AdapterType } from '../../pluggableElementTypes'

import type PluginManager from '../../PluginManager'

export default function CytobandAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'CytobandAdapter',
        configSchema,
        adapterMetadata: {
          hiddenFromGUI: true,
        },
        getAdapterClass: () => import('./CytobandAdapter').then(f => f.default),
      }),
  )
}
