import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { FileLocation } from '@jbrowse/core/util/types'
import {
  AdapterClass as SPARQLAdapterClass,
  configSchema as sparqlAdapterConfigSchema,
} from './SPARQLAdapter'
import { AdapterGuesser, getFileName } from '@jbrowse/core/util/tracks'

export default class RdfPlugin extends Plugin {
  name = 'RdfPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          AdapterClass: SPARQLAdapterClass,
          configSchema: sparqlAdapterConfigSchema,
          displayName: 'SPARQL adapter',
          name: 'SPARQLAdapter',
        }),
    )
    pluginManager.addToExtensionPoint(
      'Core-guessAdapterForLocation',
      (adapterGuesser: AdapterGuesser) => {
        return (
          file: FileLocation,
          index?: FileLocation,
          adapterHint?: string,
        ) => {
          const regexGuess = /\/sparql$/i
          const adapterName = 'SPARQLAdapter'
          const fileName = getFileName(file)
          if (regexGuess.test(fileName) || adapterHint === adapterName) {
            return {
              endpoint: file,
              type: adapterName,
            }
          }
          return adapterGuesser(file, index, adapterHint)
        }
      },
    )
  }
}
