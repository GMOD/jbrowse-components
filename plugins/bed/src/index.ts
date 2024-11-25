import Plugin from '@jbrowse/core/Plugin'
import {
  getFileName,
  makeIndex,
  makeIndexType,
} from '@jbrowse/core/util/tracks'
import BedAdapterF from './BedAdapter'
import BedGraphAdapterF from './BedGraphAdapter'
import BedGraphTabixAdapterF from './BedGraphTabixAdapter'
import BedTabixAdapterF from './BedTabixAdapter'
import BedpeAdapterF from './BedpeAdapter'
import BigBedAdapterF from './BigBedAdapter'
import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AdapterGuesser,
  TrackTypeGuesser,
} from '@jbrowse/core/util/tracks'
import type { FileLocation } from '@jbrowse/core/util/types'

export default class BedPlugin extends Plugin {
  name = 'BedPlugin'

  install(pluginManager: PluginManager) {
    BigBedAdapterF(pluginManager)
    BedAdapterF(pluginManager)
    BedpeAdapterF(pluginManager)
    BedTabixAdapterF(pluginManager)
    BedGraphAdapterF(pluginManager)
    BedGraphTabixAdapterF(pluginManager)
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
          }
          if (adapterHint === adapterName) {
            return obj
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
          const regexGuess = /\.bedpe(\.gz)?$/i
          const adapterName = 'BedpeAdapter'
          const fileName = getFileName(file)
          if (regexGuess.test(fileName) || adapterHint === adapterName) {
            return {
              type: adapterName,
              bedpeLocation: file,
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

    pluginManager.addToExtensionPoint(
      'Core-guessTrackTypeForLocation',
      (trackTypeGuesser: TrackTypeGuesser) => (adapterName: string) =>
        adapterName === 'BedpeAdapter'
          ? 'VariantTrack'
          : trackTypeGuesser(adapterName),
    )
  }
}
