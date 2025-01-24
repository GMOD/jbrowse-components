import { testAdapter } from '@jbrowse/core/util'
import {
  getFileName,
  makeIndex,
  makeIndexType,
} from '@jbrowse/core/util/tracks'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AdapterGuesser,
  TrackTypeGuesser,
} from '@jbrowse/core/util/tracks'
import type { FileLocation } from '@jbrowse/core/util/types'

export default function GuessAlignmentsTypesF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'Core-guessAdapterForLocation',
    (adapterGuesser: AdapterGuesser) => {
      return (
        file: FileLocation,
        index?: FileLocation,
        adapterHint?: string,
      ) => {
        const fileName = getFileName(file)
        const indexName = index && getFileName(index)

        if (testAdapter(fileName, /\.bam$/i, adapterHint, 'BamAdapter')) {
          return {
            type: 'BamAdapter',
            bamLocation: file,
            index: {
              location: index || makeIndex(file, '.bai'),
              indexType: makeIndexType(indexName, 'CSI', 'BAI'),
            },
          }
        } else if (
          testAdapter(fileName, /\.cram$/i, adapterHint, 'CramAdapter')
        ) {
          return {
            type: 'CramAdapter',
            cramLocation: file,
            craiLocation: index || makeIndex(file, '.crai'),
          }
        } else {
          return adapterGuesser(file, index, adapterHint)
        }
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
