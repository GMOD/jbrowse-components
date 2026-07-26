import { addAdapterGuesser, addTrackTypeGuesser } from '@jbrowse/core/util'
import { getFileName, makeIndex } from '@jbrowse/core/util/tracks'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { FileLocation } from '@jbrowse/core/util/types'

export default function ExtensionPointsF(pluginManager: PluginManager) {
  function addRefSeqAdapter(
    regexGuess: RegExp,
    adapterName: string,
    makeConfig: (
      file: FileLocation,
      index?: FileLocation,
    ) => Record<string, unknown>,
  ) {
    addAdapterGuesser(pluginManager, (file, index, adapterHint) => {
      const fileName = getFileName(file)
      return (regexGuess.test(fileName) && !adapterHint) ||
        adapterHint === adapterName
        ? { type: adapterName, ...makeConfig(file, index) }
        : undefined
    })
    addTrackTypeGuesser(pluginManager, testAdapterName =>
      testAdapterName === adapterName ? 'ReferenceSequenceTrack' : undefined,
    )
  }

  addRefSeqAdapter(/\.2bit$/i, 'TwoBitAdapter', file => ({
    twoBitLocation: file,
  }))
  addRefSeqAdapter(
    /\.(fa|fasta|fas|fna|mfa)$/i,
    'IndexedFastaAdapter',
    (file, index) => ({
      fastaLocation: file,
      faiLocation: index ?? makeIndex(file, '.fai'),
    }),
  )
  addRefSeqAdapter(
    /\.(fa|fasta|fas|fna|mfa)\.b?gz$/i,
    'BgzipFastaAdapter',
    file => ({
      fastaLocation: file,
      faiLocation: makeIndex(file, '.fai'),
      gziLocation: makeIndex(file, '.gzi'),
    }),
  )
}
