import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import {
  AdapterClass as SPARQLAdapterClass,
  configSchema as sparqlAdapterConfigSchema,
} from './SPARQLAdapter'

export default class extends Plugin {
  install(pluginManager) {
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
