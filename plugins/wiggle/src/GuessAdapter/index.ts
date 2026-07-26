import {
  addAdapterGuesser,
  addTrackTypeGuesser,
  testAdapter,
} from '@jbrowse/core/util'
import { getFileName } from '@jbrowse/core/util/tracks'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function GuessAdapterF(pluginManager: PluginManager) {
  addAdapterGuesser(pluginManager, (file, _index, adapterHint) => {
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
      : undefined
  })
  addTrackTypeGuesser(pluginManager, adapterName =>
    adapterName === 'BigWigAdapter' ? 'QuantitativeTrack' : undefined,
  )
}
