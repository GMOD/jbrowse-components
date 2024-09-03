import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { FileLocation } from '@jbrowse/core/util/types'

import PAFAdapterF from './PAFAdapter'
import PairwiseIndexedPAFAdapterF from './PairwiseIndexedPAFAdapter'
import MCScanAnchorsAdapterF from './MCScanAnchorsAdapter'
import MCScanSimpleAnchorsAdapterF from './MCScanSimpleAnchorsAdapter'
import MashMapAdapterF from './MashMapAdapter'
import DeltaAdapterF from './DeltaAdapter'
import ChainAdapterF from './ChainAdapter'

import {
  getFileName,
  AdapterGuesser,
  TrackTypeGuesser,
} from '@jbrowse/core/util/tracks'

export default class ComparativeAdaptersPlugin extends Plugin {
  name = 'ComparativeAdaptersPlugin'

  install(pluginManager: PluginManager) {
    PAFAdapterF(pluginManager)
    PairwiseIndexedPAFAdapterF(pluginManager)
    DeltaAdapterF(pluginManager)
    ChainAdapterF(pluginManager)
    MCScanAnchorsAdapterF(pluginManager)
    MCScanSimpleAnchorsAdapterF(pluginManager)
    MashMapAdapterF(pluginManager)

    pluginManager.addToExtensionPoint(
      'Core-guessAdapterForLocation',
      (adapterGuesser: AdapterGuesser) => {
        return (
          file: FileLocation,
          index?: FileLocation,
          adapterHint?: string,
        ) => {
          const regexGuess = /\.paf/i
          const adapterName = 'PAFAdapter'
          const fileName = getFileName(file)
          if (regexGuess.test(fileName) || adapterHint === adapterName) {
            return {
              type: adapterName,
              pafLocation: file,
            }
          }
          return adapterGuesser(file, index, adapterHint)
        }
      },
    )
    pluginManager.addToExtensionPoint(
      'Core-guessTrackTypeForLocation',
      (trackTypeGuesser: TrackTypeGuesser) => {
        return (adapterName: string) =>
          adapterName === 'PAFAdapter'
            ? 'SyntenyTrack'
            : trackTypeGuesser(adapterName)
      },
    )
  }
}
