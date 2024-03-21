import { AdapterType } from '../../pluggableElementTypes'
import PluginManager from '../../PluginManager'
import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        configSchema,
        getAdapterClass: () => import('./CytobandAdapter').then(f => f.default),
        name: 'CytobandAdapter',
      }),
  )
}
