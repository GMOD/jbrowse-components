import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import { configSchema as gff3TabixAdapterConfigSchema } from './Gff3TabixAdapter'
import AdapterGuessType from '@jbrowse/core/pluggableElementTypes/AdapterGuessType'
import { FileLocation } from '@jbrowse/core/util/types'
import { makeIndex, makeIndexType } from '@jbrowse/core/util/tracks'

export default class extends Plugin {
  name = 'GFF3TabixPlugin'

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
    pluginManager.registerAdapterGuess(
      () =>
        new AdapterGuessType({
          name: 'Gff3TabixAdapter',
          regexGuess: /\.gff3?\.b?gz$/i,
          fetchConfig: (
            file: FileLocation,
            index: FileLocation,
            indexName: string,
          ) => {
            return {
              type: 'Gff3TabixAdapter',
              gffGzLocation: file,
              index: {
                location: index || makeIndex(file, '.tbi'),
                indexType: makeIndexType(indexName, 'CSI', 'TBI'),
              },
            }
          },
        }),
    )
  }
}
