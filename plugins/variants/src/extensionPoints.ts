import PluginManager from '@jbrowse/core/PluginManager'
import { FileLocation } from '@jbrowse/core/util/types'
import {
  makeIndex,
  makeIndexType,
  getFileName,
  AdapterGuesser,
  TrackTypeGuesser,
} from '@jbrowse/core/util/tracks'

export default (pluginManager: PluginManager) => {
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
        } else if (adapterHint === adapterName) {
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
        console.log({ adapterName })

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
