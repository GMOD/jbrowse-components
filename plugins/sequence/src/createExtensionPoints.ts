import { makeIndex, getFileName } from '@jbrowse/core/util/tracks'
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
        const regexGuess = /\.2bit$/i
        const adapterName = 'TwoBitAdapter'
        const fileName = getFileName(file)
        const obj = {
          type: adapterName,
          twoBitLocation: file,
        }
        if (regexGuess.test(fileName) && !adapterHint) {
          return obj
        }
        if (adapterHint === adapterName) {
          return obj
        }
        return adapterGuesser(file, index, adapterHint)
      }
    },
  )
  pluginManager.addToExtensionPoint(
    'Core-guessTrackTypeForLocation',
    (trackTypeGuesser: TrackTypeGuesser) => {
      return (adapterName: string) => {
        if (adapterName === 'TwoBitAdapter') {
          return 'ReferenceSequenceTrack'
        }
        return trackTypeGuesser(adapterName)
      }
    },
  )

  pluginManager.addToExtensionPoint(
    'Core-guessAdapterForLocation',
    (adapterGuesser: AdapterGuesser) => {
      return (
        file: FileLocation,
        index?: FileLocation,
        adapterHint?: string,
      ) => {
        const regexGuess = /\.(fa|fasta|fas|fna|mfa)$/i
        const adapterName = 'IndexedFastaAdapter'
        const fileName = getFileName(file)
        const obj = {
          type: adapterName,
          fastaLocation: file,
          faiLocation: index || makeIndex(file, '.fai'),
        }

        if (regexGuess.test(fileName) && !adapterHint) {
          return obj
        }
        if (adapterHint === adapterName) {
          return obj
        }
        return adapterGuesser(file, index, adapterHint)
      }
    },
  )
  pluginManager.addToExtensionPoint(
    'Core-guessTrackTypeForLocation',
    (trackTypeGuesser: TrackTypeGuesser) => {
      return (adapterName: string) => {
        if (adapterName === 'IndexedFastaAdapter') {
          return 'ReferenceSequenceTrack'
        }
        return trackTypeGuesser(adapterName)
      }
    },
  )

  pluginManager.addToExtensionPoint(
    'Core-guessAdapterForLocation',
    (adapterGuesser: AdapterGuesser) => {
      return (
        file: FileLocation,
        index?: FileLocation,
        adapterHint?: string,
      ) => {
        const regexGuess = /\.(fa|fasta|fas|fna|mfa)\.b?gz$/i
        const adapterName = 'BgzipFastaAdapter'
        const fileName = getFileName(file)
        const obj = {
          type: adapterName,
          faiLocation: makeIndex(file, '.fai'),
          gziLocation: makeIndex(file, '.gzi'),
        }

        if (regexGuess.test(fileName) && !adapterHint) {
          return obj
        }
        if (adapterHint === adapterName) {
          return obj
        }
        return adapterGuesser(file, index, adapterHint)
      }
    },
  )
  pluginManager.addToExtensionPoint(
    'Core-guessTrackTypeForLocation',
    (trackTypeGuesser: TrackTypeGuesser) => {
      return (adapterName: string) => {
        if (adapterName === 'BgzipFastaAdapter') {
          return 'ReferenceSequenceTrack'
        }
        return trackTypeGuesser(adapterName)
      }
    },
  )
}
