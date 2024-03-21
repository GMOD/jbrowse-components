import PluginManager from '@jbrowse/core/PluginManager'
import { FileLocation } from '@jbrowse/core/util/types'
import {
  makeIndex,
  makeIndexType,
  getFileName,
  AdapterGuesser,
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
        const regexGuess = /\.gff3?\.b?gz$/i
        const adapterName = 'Gff3TabixAdapter'
        const fileName = getFileName(file)
        const indexName = index && getFileName(index)
        if (regexGuess.test(fileName) || adapterHint === adapterName) {
          return {
            bamLocation: file,
            gffGzLocation: file,
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
        const regexGuess = /\.gff3?$/i
        const adapterName = 'Gff3Adapter'
        const fileName = getFileName(file)
        const obj = {
          gffLocation: file,
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
}
