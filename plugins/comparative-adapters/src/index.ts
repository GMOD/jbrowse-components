import Plugin from '@jbrowse/core/Plugin'
import { getFileName } from '@jbrowse/core/util/tracks'

import BlastTabularAdapter from './BlastTabularAdapter'
import ChainAdapterF from './ChainAdapter'
import ComparativeAddTrackComponentF from './ComparativeAddTrackComponent'
import DeltaAdapterF from './DeltaAdapter'
import MCScanAnchorsAdapterF from './MCScanAnchorsAdapter'
import MCScanSimpleAnchorsAdapterF from './MCScanSimpleAnchorsAdapter'
import MashMapAdapterF from './MashMapAdapter'
import PAFAdapterF from './PAFAdapter'
import PairwiseIndexedPAFAdapterF from './PairwiseIndexedPAFAdapter'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AdapterGuesser,
  TrackTypeGuesser,
} from '@jbrowse/core/util/tracks'
import type { FileLocation } from '@jbrowse/core/util/types'

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
    BlastTabularAdapter(pluginManager)

    pluginManager.addToExtensionPoint(
      'Core-guessAdapterForLocation',
      (adapterGuesser: AdapterGuesser) => {
        return (
          file: FileLocation,
          index?: FileLocation,
          adapterHint?: string,
        ) => {
          return (/\.paf/i.test(getFileName(file)) && !adapterHint) ||
            adapterHint === 'PAFAdapter'
            ? {
                type: 'PAFAdapter',
                pafLocation: file,
              }
            : adapterGuesser(file, index, adapterHint)
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
    ComparativeAddTrackComponentF(pluginManager)
  }
}
