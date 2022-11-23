import { AdapterType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'HicAdapter',
        configSchema,
        getAdapterClass: () => import('./HicAdapter').then(r => r.default),
      }),
  )
}
