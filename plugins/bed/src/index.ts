import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { configSchema as bigBedAdapterConfigSchema } from './BigBedAdapter'
import { configSchema as bedTabixAdapterConfigSchema } from './BedTabixAdapter'
import { configSchema as bedAdapterConfigSchema } from './BedAdapter'
import { FileLocation } from '@jbrowse/core/util/types'
import {
  getFileName,
  makeIndex,
  makeIndexType,
  AdapterGuesser,
} from '@jbrowse/core/util/tracks'

export default class BedPlugin extends Plugin {
  name = 'BedPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'BigBedAdapter',
          configSchema: bigBedAdapterConfigSchema,
          getAdapterClass: () =>
            import('./BigBedAdapter/BigBedAdapter').then(r => r.default),
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
          const regexGuess = /\.(bb|bigbed)$/i
          const adapterName = 'BigBedAdapter'
          const fileName = getFileName(file)
          const obj = {
            type: adapterName,
            bigBedLocation: file,
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

    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'BedTabixAdapter',
          configSchema: bedTabixAdapterConfigSchema,
          getAdapterClass: () =>
            import('./BedTabixAdapter/BedTabixAdapter').then(r => r.default),
        }),
    )

    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'BedAdapter',
          configSchema: bedAdapterConfigSchema,
          getAdapterClass: () =>
            import('./BedAdapter/BedAdapter').then(r => r.default),
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
          const regexGuess = /\.bed\.b?gz$/i
          const adapterName = 'BedTabixAdapter'
          const fileName = getFileName(file)
          const indexName = index && getFileName(index)
          if (regexGuess.test(fileName) || adapterHint === adapterName) {
            return {
              type: adapterName,
              bedGzLocation: file,
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

    pluginManager.addToExtensionPoint(
      'Core-guessAdapterForLocation',
      (adapterGuesser: AdapterGuesser) => {
        return (
          file: FileLocation,
          index?: FileLocation,
          adapterHint?: string,
        ) => {
          const regexGuess = /\.bed$/i
          const adapterName = 'BedAdapter'
          const fileName = getFileName(file)
          if (regexGuess.test(fileName) || adapterHint === adapterName) {
            return {
              type: adapterName,
              bedLocation: file,
            }
          }
          return adapterGuesser(file, index, adapterHint)
        }
      },
    )
  }
}
