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

export default function VcfExtensionPointsF(pluginManager: PluginManager) {
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
          testAdapter(fileName, /\.vcf\.b?gz$/i, adapterHint, 'VcfTabixAdapter')
        ) {
          return {
            type: 'VcfTabixAdapter',
            vcfGzLocation: file,
            index: {
              location: index || makeIndex(file, '.tbi'),
              indexType: makeIndexType(indexName, 'CSI', 'TBI'),
            },
          }
        } else if (
          testAdapter(fileName, /\.vcf(\.gz)?$/i, adapterHint, 'VcfAdapter')
        ) {
          return {
            type: 'VcfAdapter',
            vcfLocation: file,
          }
        } else if (
          testAdapter(
            fileName,
            /\.ld\.b?gz$/i,
            adapterHint,
            'PlinkLDTabixAdapter',
          )
        ) {
          // Gzipped LD files use tabix adapter
          return {
            type: 'PlinkLDTabixAdapter',
            ldLocation: file,
            index: {
              location: index || makeIndex(file, '.tbi'),
              indexType: makeIndexType(indexName, 'CSI', 'TBI'),
            },
          }
        } else if (
          testAdapter(fileName, /\.ld$/i, adapterHint, 'PlinkLDAdapter')
        ) {
          // Plain .ld files use in-memory adapter
          return {
            type: 'PlinkLDAdapter',
            ldLocation: file,
          }
        } else if (
          testAdapter(fileName, /\.h5$/i, adapterHint, 'LdmatAdapter')
        ) {
          // HDF5 files in ldmat format
          return {
            type: 'LdmatAdapter',
            ldmatLocation: file,
          }
        } else {
          return adapterGuesser(file, index, adapterHint)
        }
      }
    },
  )
  pluginManager.addToExtensionPoint(
    'Core-guessTrackTypeForLocation',
    (trackTypeGuesser: TrackTypeGuesser) => {
      return (adapterName: string) => {
        if (['VcfTabixAdapter', 'VcfAdapter'].includes(adapterName)) {
          return 'VariantTrack'
        }
        if (
          ['PlinkLDAdapter', 'PlinkLDTabixAdapter', 'LdmatAdapter'].includes(
            adapterName,
          )
        ) {
          return 'LDTrack'
        }
        return trackTypeGuesser(adapterName)
      }
    },
  )
}
