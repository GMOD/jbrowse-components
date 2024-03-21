import PluginManager from '@jbrowse/core/PluginManager'
import { FileLocation } from '@jbrowse/core/util/types'
import {
  makeIndex,
  getFileName,
  AdapterGuesser,
  TrackTypeGuesser,
} from '@jbrowse/core/util/tracks'

export default (pluginManager: PluginManager) => {
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
          twoBitLocation: file,
          type: adapterName,
        }
        if (regexGuess.test(fileName) && !adapterHint) {
          return obj
        } else if (adapterHint === adapterName) {
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
          faiLocation: index || makeIndex(file, '.fai'),
          fastaLocation: file,
          type: adapterName,
        }

        if (regexGuess.test(fileName) && !adapterHint) {
          return obj
        } else if (adapterHint === adapterName) {
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
          faiLocation: makeIndex(file, '.fai'),
          gziLocation: makeIndex(file, '.gzi'),
          type: adapterName,
        }

        if (regexGuess.test(fileName) && !adapterHint) {
          return obj
        } else if (adapterHint === adapterName) {
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
