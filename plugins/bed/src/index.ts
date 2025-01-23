import Plugin from '@jbrowse/core/Plugin'
import {
  getFileName,
  makeIndex,
  makeIndexType,
} from '@jbrowse/core/util/tracks'

import BedAdapterF from './BedAdapter'
import BedGraphAdapterF from './BedGraphAdapter'
import BedGraphTabixAdapterF from './BedGraphTabixAdapter'
import BedTabixAdapterF from './BedTabixAdapter'
import BedpeAdapterF from './BedpeAdapter'
import BigBedAdapterF from './BigBedAdapter'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AdapterGuesser,
  TrackTypeGuesser,
} from '@jbrowse/core/util/tracks'
import type { FileLocation } from '@jbrowse/core/util/types'

export default class BedPlugin extends Plugin {
  name = 'BedPlugin'

  install(pluginManager: PluginManager) {
    BigBedAdapterF(pluginManager)
    BedAdapterF(pluginManager)
    BedpeAdapterF(pluginManager)
    BedTabixAdapterF(pluginManager)
    BedGraphAdapterF(pluginManager)
    BedGraphTabixAdapterF(pluginManager)

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
            (!adapterHint && /\.bedpe(\.gz)?$/i.test(fileName)) ||
            adapterHint === 'BedpeAdapter'
          ) {
            return {
              type: 'BedpeAdapter',
              bedpeAdapter: file,
            }
          } else if (
            (!adapterHint && /\.bed$/i.test(fileName)) ||
            adapterHint === 'BigBedAdapter'
          ) {
            return {
              type: 'BigBedAdapter',
              bigBedLocation: file,
            }
          } else if (
            (!adapterHint && /\.bed$/i.test(fileName)) ||
            adapterHint === 'BedAdapter'
          ) {
            return {
              type: 'BedAdapter',
              bedLocation: file,
            }
          } else if (
            (!adapterHint &&
              (/\.bg$/i.test(fileName) || /\.bedgraph$/i.test(fileName))) ||
            adapterHint === 'BedGraphAdapter'
          ) {
            return {
              type: 'BedGraphAdapter',
              bedGraphLocation: file,
            }
          } else if (
            (!adapterHint &&
              (/\.bg.gz$/i.test(fileName) ||
                /\.bedgraph.gz$/i.test(fileName))) ||
            adapterHint === 'BedGraphTabixAdapter'
          ) {
            return {
              type: 'BedGraphTabixAdapter',
              bedGraphGzLocation: file,
              index: {
                location: index || makeIndex(file, '.tbi'),
                indexType: makeIndexType(indexName, 'CSI', 'TBI'),
              },
            }
          } else if (
            (!adapterHint && /\.bed\.b?gz$/i.test(fileName)) ||
            adapterHint === 'BedTabixAdapter'
          ) {
            return {
              type: 'BedTabixAdapter',
              bedGzLocation: file,
              index: {
                location: index || makeIndex(file, '.tbi'),
                indexType: makeIndexType(indexName, 'CSI', 'TBI'),
              },
            }
          } else {
            return adapterGuesser(file, index, adapterHint)
          }
        }
      },
    )

    pluginManager.addToExtensionPoint(
      'Core-guessTrackTypeForLocation',
      (trackTypeGuesser: TrackTypeGuesser) => (adapterName: string) => {
        return (
          {
            BedAdapter: 'VariantTrack',
            BedGraphAdapter: 'QuantitativeTrack',
            BedGraphTabixAdapter: 'QuantitativeTrack',
          }[adapterName] || trackTypeGuesser(adapterName)
        )
      },
    )
  }
}
