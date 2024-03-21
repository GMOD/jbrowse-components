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
        const regexGuess = /\.cram$/i
        const adapterName = 'CramAdapter'
        const fileName = getFileName(file)
        const obj = {
          craiLocation: index || makeIndex(file, '.crai'),
          cramLocation: file,
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
        const regexGuess = /\.bam$/i
        const adapterName = 'BamAdapter'
        const fileName = getFileName(file)
        const indexName = index && getFileName(index)

        const obj = {
          bamLocation: file,
          index: {
            indexType: makeIndexType(indexName, 'CSI', 'BAI'),
            location: index || makeIndex(file, '.bai'),
          },
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
    'Core-guessTrackTypeForLocation',
    (trackTypeGuesser: TrackTypeGuesser) => {
      return (adapterName: string) => {
        if (adapterName === 'BamAdapter' || adapterName === 'CramAdapter') {
          return 'AlignmentsTrack'
        }
        return trackTypeGuesser(adapterName)
      }
    },
  )
}
