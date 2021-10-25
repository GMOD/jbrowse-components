import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import { configSchema as gff3TabixAdapterConfigSchema } from './Gff3TabixAdapter'
import { FileLocation } from '@jbrowse/core/util/types'
import {
  makeIndex,
  makeIndexType,
  AdapterGuesser,
  getFileName,
} from '@jbrowse/core/util/tracks'
import { configSchema as gff3AdapterConfigSchema } from './Gff3Adapter'

export default class extends Plugin {
  name = 'GFF3Plugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'Gff3TabixAdapter',
          configSchema: gff3TabixAdapterConfigSchema,
          getAdapterClass: () =>
            import('./Gff3TabixAdapter/Gff3TabixAdapter').then(r => r.default),
        }),
    )
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
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'Gff3Adapter',
          configSchema: gff3AdapterConfigSchema,
          getAdapterClass: () =>
            import('./Gff3Adapter/Gff3Adapter').then(r => r.default),
        }),
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
          if (regexGuess.test(fileName) || adapterHint === adapterName) {
            return {
              type: adapterName,
              gffLocation: file,
            }
          }
          return adapterGuesser(file, index, adapterHint)
        }
      },
    )
  }
}
