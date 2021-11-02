import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import { configSchema as gtfAdapterConfigSchema } from './GtfAdapter'
import { FileLocation } from '@jbrowse/core/util/types'
import { AdapterGuesser, getFileName } from '@jbrowse/core/util/tracks'

export default class GtfPlugin extends Plugin {
  name = 'GTFPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'GtfAdapter',
          configSchema: gtfAdapterConfigSchema,
          getAdapterClass: () =>
            import('./GtfAdapter/GtfAdapter').then(r => r.default),
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
          const regexGuess = /\.gtf(\.gz)?$/i
          const adapterName = 'GtfAdapter'
          const fileName = getFileName(file)
          if (regexGuess.test(fileName) || adapterHint === adapterName) {
            return {
              type: adapterName,
              gtfLocation: file,
            }
          }
          return adapterGuesser(file, index, adapterHint)
        }
      },
    )
  }
}
