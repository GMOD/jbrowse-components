import {
  addAdapterGuesser,
  addTrackTypeGuesser,
  testAdapter,
} from '@jbrowse/core/util'
import {
  getFileName,
  makeIndex,
  makeIndexType,
} from '@jbrowse/core/util/tracks'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function GuessAlignmentsTypesF(pluginManager: PluginManager) {
  addAdapterGuesser(pluginManager, (file, index, adapterHint) => {
    const fileName = getFileName(file)
    const indexName = index && getFileName(index)

    if (testAdapter(fileName, /\.bam$/i, adapterHint, 'BamAdapter')) {
      return {
        type: 'BamAdapter',
        bamLocation: file,
        index: {
          location: index ?? makeIndex(file, '.bai'),
          indexType: makeIndexType(indexName, 'CSI', 'BAI'),
        },
      }
    } else if (testAdapter(fileName, /\.cram$/i, adapterHint, 'CramAdapter')) {
      return {
        type: 'CramAdapter',
        cramLocation: file,
        craiLocation: index ?? makeIndex(file, '.crai'),
      }
    } else if (
      testAdapter(fileName, /\.sam(\.gz)?$/i, adapterHint, 'SamAdapter')
    ) {
      return {
        type: 'SamAdapter',
        samLocation: file,
      }
    } else {
      return undefined
    }
  })
  addTrackTypeGuesser(pluginManager, adapterName =>
    adapterName === 'BamAdapter' ||
    adapterName === 'CramAdapter' ||
    adapterName === 'SamAdapter'
      ? 'AlignmentsTrack'
      : undefined,
  )
}
