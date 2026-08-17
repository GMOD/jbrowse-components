import {
  addAdapterGuesser,
  addTrackTypeGuesser,
  testAdapter,
} from '@jbrowse/core/util'
import { getFileName, guessTabixIndex } from '@jbrowse/core/util/tracks'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function GuessAdapterF(pluginManager: PluginManager) {
  addAdapterGuesser(pluginManager, (file, index, adapterHint) => {
    const fileName = getFileName(file)
    if (
      testAdapter(fileName, /\.bedpe(\.gz)?$/i, adapterHint, 'BedpeAdapter')
    ) {
      return {
        type: 'BedpeAdapter',
        bedpeLocation: file,
      }
    } else if (
      adapterHint === 'StarFusionAdapter' ||
      (!adapterHint &&
        /(star-?fusion|fusion_predictions)/i.test(fileName) &&
        /\.tsv(\.gz)?$/i.test(fileName))
    ) {
      return {
        type: 'StarFusionAdapter',
        starFusionLocation: file,
      }
    } else if (
      testAdapter(fileName, /\.bb$/i, adapterHint, 'BigBedAdapter') ||
      testAdapter(fileName, /\.bigbed$/i, adapterHint, 'BigBedAdapter')
    ) {
      return {
        type: 'BigBedAdapter',
        bigBedLocation: file,
      }
    } else if (testAdapter(fileName, /\.bed$/i, adapterHint, 'BedAdapter')) {
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
      testAdapter(fileName, /\.bg\.gz$/i, adapterHint, 'BedGraphTabixAdapter')
    ) {
      return {
        type: 'BedGraphTabixAdapter',
        bedGraphGzLocation: file,
        index: guessTabixIndex(file, index),
      }
    } else if (
      testAdapter(
        fileName,
        /\.bedmethyl\.gz$/i,
        adapterHint,
        'BedTabixAdapter',
      ) ||
      testAdapter(fileName, /\.bed\.gz$/i, adapterHint, 'BedTabixAdapter')
    ) {
      return {
        type: 'BedTabixAdapter',
        bedGzLocation: file,
        index: guessTabixIndex(file, index),
      }
    } else {
      return undefined
    }
  })

  addTrackTypeGuesser(pluginManager, (adapterName, file) =>
    adapterName === 'BedTabixAdapter' &&
    file &&
    /\.bedmethyl\.gz$/i.test(getFileName(file))
      ? 'MultiQuantitativeTrack'
      : {
          BedpeAdapter: 'VariantTrack',
          StarFusionAdapter: 'VariantTrack',
          BedGraphAdapter: 'QuantitativeTrack',
          BedGraphTabixAdapter: 'QuantitativeTrack',
        }[adapterName],
  )
}
