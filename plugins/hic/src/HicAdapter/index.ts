import { AdapterType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        configSchema,
        displayName: 'Hi-C adapter',
        getAdapterClass: () => import('./HicAdapter').then(r => r.default),
        name: 'HicAdapter',
      }),
  )
}
