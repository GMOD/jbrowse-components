import { AdapterType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'

import configSchema from './configSchema'

export default function HapIbdAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(() => {
    return new AdapterType({
      name: 'HapIbdAdapter',
      displayName: 'hapIBD (identity by descent) adapter',
      configSchema,
      getAdapterClass: () => import('./HapIbdAdapter').then(r => r.default),
    })
  })
}
