import { AdapterType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import configSchema from './configSchema'

export default function HicAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'HicAdapter',
        displayName: 'Hi-C adapter',
        configSchema,
        getAdapterClass: () => import('./HicAdapter').then(r => r.default),
      }),
  )
}
