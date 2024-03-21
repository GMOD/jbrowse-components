import { AdapterType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'

import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        configSchema,
        displayName: 'NCList adapter',
        getAdapterClass: () => import('./NCListAdapter').then(r => r.default),
        name: 'NCListAdapter',
      }),
  )
}
