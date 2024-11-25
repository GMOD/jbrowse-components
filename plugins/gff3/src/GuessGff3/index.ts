import {
  makeIndex,
  makeIndexType,
  getFileName,
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
        const regexGuess = /\.gff3?\.b?gz$/i
        const adapterName = 'Gff3TabixAdapter'
        const fileName = getFileName(file)
        const indexName = index && getFileName(index)
        if (regexGuess.test(fileName) || adapterHint === adapterName) {
          return {
            type: adapterName,
            bamLocation: file,
            gffGzLocation: file,
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
        const regexGuess = /\.gff3?$/i
        const adapterName = 'Gff3Adapter'
        const fileName = getFileName(file)
        const obj = {
          type: adapterName,
          gffLocation: file,
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
}
