import {
  makeIndex,
  makeIndexType,
  getFileName,
} from '@jbrowse/core/util/tracks'
import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AdapterGuesser,
  TrackTypeGuesser,
} from '@jbrowse/core/util/tracks'
import type { FileLocation } from '@jbrowse/core/util/types'

export default function ExtensionPointsF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'Core-guessAdapterForLocation',
    (adapterGuesser: AdapterGuesser) => {
      return (
        file: FileLocation,
        index?: FileLocation,
        adapterHint?: string,
      ) => {
        const regexGuess = /\.vcf\.b?gz$/i
        const adapterName = 'VcfTabixAdapter'
        const fileName = getFileName(file)
        const indexName = index && getFileName(index)
        const obj = {
          type: adapterName,
          vcfGzLocation: file,
          index: {
            location: index || makeIndex(file, '.tbi'),
            indexType: makeIndexType(indexName, 'CSI', 'TBI'),
          },
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
    'Core-guessTrackTypeForLocation',
    (trackTypeGuesser: TrackTypeGuesser) => {
      return (adapterName: string) => {
        if (adapterName === 'VcfTabixAdapter' || adapterName === 'VcfAdapter') {
          return 'VariantTrack'
        }
        return trackTypeGuesser(adapterName)
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
        const regexGuess = /\.vcf$/i
        const adapterName = 'VcfAdapter'
        const fileName = getFileName(file)
        if (regexGuess.test(fileName) || adapterHint === adapterName) {
          return {
            type: adapterName,
            vcfLocation: file,
          }
        }
        return adapterGuesser(file, index, adapterHint)
      }
    },
  )
}
