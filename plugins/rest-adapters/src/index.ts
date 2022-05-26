import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { FileLocation } from '@jbrowse/core/util/types'
import { configSchema as restFeatureAdapterConfigSchema } from './JBrowseRESTFeatureAdapter'
import { AdapterGuesser, getFileName } from '@jbrowse/core/util/tracks'


export default class JBrowseRESTAdaptersPlugin extends Plugin {
  name = 'JBrowseRESTAdaptersPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'JBrowseRESTFeatureAdapter',
          configSchema: restFeatureAdapterConfigSchema,
          getAdapterClass: () =>
            import('./JBrowseRESTFeatureAdapter/JBrowseRESTFeatureAdapter').then(r => r.default),
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
          const regexGuess = /trackData.jsonz?$/i
          const adapterName = 'JBrowseRESTFeatureAdapter'
          const fileName = getFileName(file)
          if (regexGuess.test(fileName) || adapterHint === adapterName) {
            return {
              type: adapterName,
              rootUrlTemplate: file,
            }
          }
          return adapterGuesser(file, index, adapterHint)
        }
      },
    )

    // pluginManager.addTextSearchAdapterType(
    //   () =>
    //     new TextSearchAdapterType({
    //       name: 'JBrowse1TextSearchAdapter',
    //       configSchema: jbrowse1AdapterConfigSchema,
    //       AdapterClass: JBrowse1TextSearchAdapterClass,
    //       description: 'A JBrowse 1 text search adapter',
    //     }),
    // )
  }
}
