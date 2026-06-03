import { testAdapter } from '@jbrowse/core/util'
import {
  getFileName,
  makeIndex,
  makeIndexType,
} from '@jbrowse/core/util/tracks'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AdapterGuesser } from '@jbrowse/core/util/tracks'
import type { FileLocation } from '@jbrowse/core/util/types'

export default function GuessAdapterF(pluginManager: PluginManager) {
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
        } else if (
          testAdapter(fileName, /\.gtf$/i, adapterHint, 'GtfAdapter')
        ) {
          return {
            type: 'GtfAdapter',
            gtfLocation: file,
          }
        } else {
          return adapterGuesser(file, index, adapterHint)
        }
      }
    },
  )
}
