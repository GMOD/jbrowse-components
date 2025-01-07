import { AdapterType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'

import configSchema from './configSchema'

export default function SPARQLAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'SPARQLAdapter',
        displayName: 'SPARQL adapter',
        configSchema,
        getAdapterClass: () => import('./SPARQLAdapter').then(r => r.default),
      }),
  )
}
