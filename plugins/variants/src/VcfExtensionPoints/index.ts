import {
  addAdapterGuesser,
  addTrackTypeGuesser,
  testAdapter,
} from '@jbrowse/core/util'
import { getFileName, guessTabixIndex } from '@jbrowse/core/util/tracks'

import { isPrecomputedLDAdapter } from '../RenderLDDataRPC/types.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function VcfExtensionPointsF(pluginManager: PluginManager) {
  addAdapterGuesser(pluginManager, (file, index, adapterHint) => {
    const fileName = getFileName(file)
    if (
      testAdapter(fileName, /\.vcf\.b?gz$/i, adapterHint, 'VcfTabixAdapter')
    ) {
      return {
        type: 'VcfTabixAdapter',
        vcfGzLocation: file,
        index: guessTabixIndex(file, index),
      }
    } else if (
      testAdapter(fileName, /\.vcf(\.gz)?$/i, adapterHint, 'VcfAdapter')
    ) {
      return {
        type: 'VcfAdapter',
        vcfLocation: file,
      }
    } else if (
      testAdapter(fileName, /\.ld\.b?gz$/i, adapterHint, 'PlinkLDTabixAdapter')
    ) {
      // Gzipped LD files use tabix adapter
      return {
        type: 'PlinkLDTabixAdapter',
        ldLocation: file,
        index: guessTabixIndex(file, index),
      }
    } else if (testAdapter(fileName, /\.ld$/i, adapterHint, 'PlinkLDAdapter')) {
      // Plain .ld files use in-memory adapter
      return {
        type: 'PlinkLDAdapter',
        ldLocation: file,
      }
    } else if (testAdapter(fileName, /\.h5$/i, adapterHint, 'LdmatAdapter')) {
      // HDF5 files in ldmat format
      return {
        type: 'LdmatAdapter',
        ldmatLocation: file,
      }
    } else {
      return undefined
    }
  })
  addTrackTypeGuesser(pluginManager, adapterName => {
    if (['VcfTabixAdapter', 'VcfAdapter'].includes(adapterName)) {
      return 'VariantTrack'
    }
    if (isPrecomputedLDAdapter(adapterName)) {
      return 'LDTrack'
    }
    return undefined
  })
}
