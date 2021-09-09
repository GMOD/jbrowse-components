import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { configSchema as bigBedAdapterConfigSchema } from './BigBedAdapter'
import { configSchema as bedTabixAdapterConfigSchema } from './BedTabixAdapter'
import { FileLocation } from '@jbrowse/core/util/types'
import { makeIndex, makeIndexType } from '@jbrowse/core/util/tracks'

export default class BedPlugin extends Plugin {
  name = 'BedPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'BigBedAdapter',
          configSchema: bigBedAdapterConfigSchema,
          addTrackConfig: {
            regexGuess: /\.(bb|bigbed)$/i,
            fetchConfig: (file: FileLocation) => {
              return {
                type: 'BigBedAdapter',
                bigBedLocation: file,
              }
            },
          },
          getAdapterClass: () =>
            import('./BigBedAdapter/BigBedAdapter').then(r => r.default),
        }),
    )

    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'BedTabixAdapter',
          configSchema: bedTabixAdapterConfigSchema,
          addTrackConfig: {
            regexGuess: /\.bed\.b?gz$/i,
            fetchConfig: (
              file: FileLocation,
              index: FileLocation,
              indexName: string,
            ) => {
              return {
                type: 'BedTabixAdapter',
                bedGzLocation: file,
                index: {
                  location: index || makeIndex(file, '.tbi'),
                  indexType: makeIndexType(indexName, 'CSI', 'TBI'),
                },
              }
            },
          },
          getAdapterClass: () =>
            import('./BedTabixAdapter/BedTabixAdapter').then(r => r.default),
        }),
    )
  }
}
