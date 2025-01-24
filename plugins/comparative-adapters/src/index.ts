import Plugin from '@jbrowse/core/Plugin'

import BlastTabularAdapter from './BlastTabularAdapter'
import ChainAdapterF from './ChainAdapter'
import ComparativeAddTrackComponentF from './ComparativeAddTrackComponent'
import DeltaAdapterF from './DeltaAdapter'
import GuessAdapterF from './GuessAdapter'
import MCScanAddTrackComponentF from './MCScanAddTrackComponent'
import MCScanAnchorsAdapterF from './MCScanAnchorsAdapter'
import MCScanSimpleAnchorsAdapterF from './MCScanSimpleAnchorsAdapter'
import MashMapAdapterF from './MashMapAdapter'
import PAFAdapterF from './PAFAdapter'
import PairwiseIndexedPAFAdapterF from './PairwiseIndexedPAFAdapter'

import type PluginManager from '@jbrowse/core/PluginManager'

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
    ComparativeAddTrackComponentF(pluginManager)
    MCScanAddTrackComponentF(pluginManager)
    GuessAdapterF(pluginManager)
  }
}
