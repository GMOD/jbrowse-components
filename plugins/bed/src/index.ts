import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import BigBedAdapterF from './BigBedAdapter'
import BedpeAdapterF from './BedpeAdapter'
import BedTabixAdapterF from './BedTabixAdapter'
import BedAdapterF from './BedAdapter'
import { FileLocation } from '@jbrowse/core/util/types'
import {
  getFileName,
  makeIndex,
  makeIndexType,
  AdapterGuesser,
  TrackTypeGuesser,
} from '@jbrowse/core/util/tracks'

export default class BedPlugin extends Plugin {
  name = 'BedPlugin'

  install(pluginManager: PluginManager) {
    BigBedAdapterF(pluginManager)
    BedAdapterF(pluginManager)
    BedpeAdapterF(pluginManager)
    BedTabixAdapterF(pluginManager)
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
            bigBedLocation: file,
            type: adapterName,
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
              bedpeLocation: file,
              type: adapterName,
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
              bedGzLocation: file,
              index: {
                indexType: makeIndexType(indexName, 'CSI', 'TBI'),
                location: index || makeIndex(file, '.tbi'),
              },
              type: adapterName,
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
              bedLocation: file,
              type: adapterName,
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
