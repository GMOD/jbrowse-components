import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function NCListAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'NCListAdapter',
        displayName: 'NCList adapter',
        configSchema,
        getAdapterClass: () => import('./NCListAdapter').then(r => r.default),
      }),
  )
}
