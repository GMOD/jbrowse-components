import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import { configSchema as gtfTabixAdapterConfigSchema } from './GtfTabixAdapter'
import { FileLocation } from '@jbrowse/core/util/types'
import {
  makeIndex,
  makeIndexType,
  AdapterGuesser,
  getFileName,
} from '@jbrowse/core/util/tracks'

export default class GtfPlugin extends Plugin {
  name = 'GTFPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'GtfTabixAdapter',
          configSchema: gtfTabixAdapterConfigSchema,
          getAdapterClass: () =>
            import('./GtfTabixAdapter/GtfTabixAdapter').then(r => r.default),
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
          const regexGuess = /\.gtf?\.b?gz$/i
          const adapterName = 'GtfTabixAdapter'
          const fileName = getFileName(file)
          const indexName = index && getFileName(index)
          if (regexGuess.test(fileName) || adapterHint === adapterName) {
            return {
              type: adapterName,
              gtfGzLocation: file,
              index: {
                location: index || makeIndex(file, '.tbi'),
                indexType: makeIndexType(indexName, 'CSI', 'TBI'),
              },
            }
          }
          return adapterGuesser(file, index, adapterHint)
        }
      },
    )
  }
}
