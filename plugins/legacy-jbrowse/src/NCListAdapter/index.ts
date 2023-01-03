import { AdapterType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'

import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
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
