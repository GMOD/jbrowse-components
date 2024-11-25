import Plugin from '@jbrowse/core/Plugin'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import { getFileName } from '@jbrowse/core/util/tracks'
import { configSchema as gtfAdapterConfigSchema } from './GtfAdapter'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AdapterGuesser } from '@jbrowse/core/util/tracks'
import type { FileLocation } from '@jbrowse/core/util/types'

export default class GtfPlugin extends Plugin {
  name = 'GTFPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'GtfAdapter',
          displayName: 'GTF adapter',
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

          const obj = {
            type: adapterName,
            gtfLocation: file,
          }
          if (regexGuess.test(fileName) && !adapterHint) {
            return obj
          } else if (adapterHint === adapterName) {
            return obj
          }
          return adapterGuesser(file, index, adapterHint)
        }
      },
    )
  }
}
