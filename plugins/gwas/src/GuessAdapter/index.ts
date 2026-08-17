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
    // Only `.txt.gz` (the Pan-UKBB GWAS flat-file convention) auto-guesses to
    // GWASAdapter. `.bed.gz` is intentionally left to BedTabixAdapter —
    // distinguishing a GWAS BED from a generic BED would need column-level
    // sniffing, not just the extension. An explicit adapterHint still forces
    // GWASAdapter for a `.bed.gz`.
    return testAdapter(fileName, /\.txt\.gz$/i, adapterHint, 'GWASAdapter')
      ? {
          type: 'GWASAdapter',
          bedGzLocation: file,
          index: guessTabixIndex(file, index),
        }
      : undefined
  })

  addTrackTypeGuesser(pluginManager, adapterName =>
    adapterName === 'GWASAdapter' ? 'GWASTrack' : undefined,
  )
}
