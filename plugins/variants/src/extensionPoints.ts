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

export default function ExtensionPointsF(pluginManager: PluginManager) {
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
          (/\.vcf\.b?gz$/i.test(fileName) && !adapterHint) ||
          adapterHint === 'VcfTabixAdapter'
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
          (!adapterHint && /\.vcf$/i.test(fileName)) ||
          adapterHint === 'VcfAdapter'
        ) {
          return {
            type: 'VcfAdapter',
            vcfLocation: file,
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
        return adapterName === 'VcfTabixAdapter' || adapterName === 'VcfAdapter'
          ? 'VariantTrack'
          : trackTypeGuesser(adapterName)
      }
    },
  )
}
