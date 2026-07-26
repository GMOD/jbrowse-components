import { addAdapterGuesser, testAdapter } from '@jbrowse/core/util'
import {
  getFileName,
  makeIndex,
  makeIndexType,
} from '@jbrowse/core/util/tracks'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function GuessAdapterF(pluginManager: PluginManager) {
  addAdapterGuesser(pluginManager, (file, index, adapterHint) => {
    const fileName = getFileName(file)
    const indexName = index && getFileName(index)
    if (
      testAdapter(fileName, /\.gtf\.b?gz$/i, adapterHint, 'GtfTabixAdapter')
    ) {
      return {
        type: 'GtfTabixAdapter',
        gtfGzLocation: file,
        index: {
          location: index ?? makeIndex(file, '.tbi'),
          indexType: makeIndexType(indexName, 'CSI', 'TBI'),
        },
      }
    } else if (testAdapter(fileName, /\.gtf$/i, adapterHint, 'GtfAdapter')) {
      return {
        type: 'GtfAdapter',
        gtfLocation: file,
      }
    } else {
      return undefined
    }
  })
}
