import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { FileLocation } from '@jbrowse/core/util/types'
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
          addTrackConfig: {
            regexGuess: /\/sparql$/i,
            fetchConfig: (file: FileLocation) => {
              return {
                type: 'SPARQLAdapter',
                endpoint: file,
              }
            },
          },
          AdapterClass: SPARQLAdapterClass,
        }),
    )
  }
}
