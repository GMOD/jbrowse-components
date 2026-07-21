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
    pluginManager.addToExtensionPoint(
      'Core-guessAdapterForLocation',
      adapterGuesser => {
        return (
          file: FileLocation,
          index?: FileLocation,
          adapterHint?: string,
        ) => {
          const fileName = getFileName(file)
          if (
            (regexGuess.test(fileName) && !adapterHint) ||
            adapterHint === adapterName
          ) {
            return { type: adapterName, ...makeConfig(file, index) }
          }
          return adapterGuesser(file, index, adapterHint)
        }
      },
    )
    pluginManager.addToExtensionPoint(
      'Core-guessTrackTypeForLocation',
      trackTypeGuesser => {
        return (testAdapterName: string) =>
          testAdapterName === adapterName
            ? 'ReferenceSequenceTrack'
            : trackTypeGuesser(testAdapterName)
      },
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
