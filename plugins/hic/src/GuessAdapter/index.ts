import { addAdapterGuesser, addTrackTypeGuesser } from '@jbrowse/core/util'
import { getFileName } from '@jbrowse/core/util/tracks'

import type PluginManager from '@jbrowse/core/PluginManager'

// #region guessers
export default function GuessAdapterF(pluginManager: PluginManager) {
  addAdapterGuesser(pluginManager, (file, _index, adapterHint) => {
    const fileName = getFileName(file)
    return (/\.hic$/i.test(fileName) && !adapterHint) ||
      adapterHint === 'HicAdapter'
      ? {
          type: 'HicAdapter',
          hicLocation: file,
        }
      : undefined
  })
  addTrackTypeGuesser(pluginManager, adapterName =>
    adapterName === 'HicAdapter' ? 'HicTrack' : undefined,
  )
}
// #endregion
