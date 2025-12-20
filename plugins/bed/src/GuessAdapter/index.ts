import { testAdapter } from '@jbrowse/core/util'
import {
  getFileName,
  makeIndex,
  makeIndexType,
} from '@jbrowse/core/util/tracks'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AdapterGuesser,
  TrackTypeGuesser,
} from '@jbrowse/core/util/tracks'
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
          testAdapter(fileName, /\.bedpe(\.gz)?$/i, adapterHint, 'BedpeAdapter')
        ) {
          return {
            type: 'BedpeAdapter',
            bedpeLocation: file,
          }
        } else if (
          testAdapter(fileName, /\.bb$/i, adapterHint, 'BigBedAdapter') ||
          testAdapter(fileName, /\.bigBed?$/i, adapterHint, 'BigBedAdapter')
        ) {
          return {
            type: 'BigBedAdapter',
            bigBedLocation: file,
          }
        } else if (
          testAdapter(fileName, /\.bed$/i, adapterHint, 'BedAdapter')
        ) {
          return {
            type: 'BedAdapter',
            bedLocation: file,
          }
        } else if (
          testAdapter(fileName, /\.bg$/i, adapterHint, 'BedGraphAdapter')
        ) {
          return {
            type: 'BedGraphAdapter',
            bedGraphLocation: file,
          }
        } else if (
          testAdapter(
            fileName,
            /\.bg(\.gz)?$/i,
            adapterHint,
            'BedGraphTabixAdapter',
          )
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
          testAdapter(fileName, /\.bed\.gz$/i, adapterHint, 'BedTabixAdapter')
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
          BedpeAdapter: 'VariantTrack',
          BedGraphAdapter: 'QuantitativeTrack',
          BedGraphTabixAdapter: 'QuantitativeTrack',
        }[adapterName] || trackTypeGuesser(adapterName)
      )
    },
  )
}
