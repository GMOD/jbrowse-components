import { testAdapter } from '@jbrowse/core/util'
import { getFileName } from '@jbrowse/core/util/tracks'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AdapterGuesser,
  TrackTypeGuesser,
} from '@jbrowse/core/util/tracks'
import type { FileLocation } from '@jbrowse/core/util/types'

export default function GuessAdapterF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'Core-guessAdapterForLocation',
    (cb: AdapterGuesser) => {
      return (
        file: FileLocation,
        index?: FileLocation,
        adapterHint?: string,
      ) => {
        const fileName = getFileName(file)
        return testAdapter(
          fileName,
          /\.(bw|bigwig)$/i,
          adapterHint,
          'BigWigAdapter',
        )
          ? {
              type: 'BigWigAdapter',
              bigWigLocation: file,
            }
          : cb(file, index, adapterHint)
      }
    },
  )
  pluginManager.addToExtensionPoint(
    'Core-guessTrackTypeForLocation',
    (trackTypeGuesser: TrackTypeGuesser) => {
      return (adapterName: string, fileName?: string) => {
        return adapterName === 'BigWigAdapter'
          ? 'QuantitativeTrack'
          : trackTypeGuesser(adapterName, fileName)
      }
    },
  )
}
