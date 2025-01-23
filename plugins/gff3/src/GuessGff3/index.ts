import {
  getFileName,
  makeIndex,
  makeIndexType,
} from '@jbrowse/core/util/tracks'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AdapterGuesser } from '@jbrowse/core/util/tracks'
import type { FileLocation } from '@jbrowse/core/util/types'

export default function GuessGff3F(pluginManager: PluginManager) {
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
          (!adapterHint && /\.gff3?\.b?gz$/i.test(fileName)) ||
          adapterHint === 'Gff3TabixAdapter'
        ) {
          return {
            type: 'Gff3TabixAdapter',
            bamLocation: file,
            gffGzLocation: file,
            index: {
              location: index || makeIndex(file, '.tbi'),
              indexType: makeIndexType(indexName, 'CSI', 'TBI'),
            },
          }
        } else if (
          (!adapterHint && /\.gff3?$/i.test(fileName)) ||
          adapterHint === 'Gff3Adapter'
        ) {
          return {
            type: 'Gff3Adapter',
            gffLocation: file,
          }
        } else {
          return adapterGuesser(file, index, adapterHint)
        }
      }
    },
  )
}
