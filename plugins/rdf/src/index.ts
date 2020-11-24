import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  AdapterClass as SPARQLAdapterClass,
  configSchema as sparqlAdapterConfigSchema,
} from './SPARQLAdapter'

export default class RdfPlugin extends Plugin {
  name = 'RdfPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'SPARQLAdapter',
          configSchema: sparqlAdapterConfigSchema,
          AdapterClass: SPARQLAdapterClass,
        }),
    )
  }
}
