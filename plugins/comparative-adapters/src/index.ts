import Plugin from '@jbrowse/core/Plugin'

import BlastTabularAdapter from './BlastTabularAdapter/index.ts'
import ChainAdapterF from './ChainAdapter/index.ts'
import ComparativeAddTrackComponentF from './ComparativeAddTrackComponent/index.tsx'
import DeltaAdapterF from './DeltaAdapter/index.ts'
import GuessAdapterF from './GuessAdapter/index.ts'
import MCScanAddTrackComponentF from './MCScanAddTrackComponent/index.tsx'
import MCScanAnchorsAdapterF from './MCScanAnchorsAdapter/index.ts'
import MCScanSimpleAnchorsAdapterF from './MCScanSimpleAnchorsAdapter/index.ts'
import MashMapAdapterF from './MashMapAdapter/index.ts'
import PAFAdapterF from './PAFAdapter/index.ts'
import PairwiseIndexedPAFAdapterF from './PairwiseIndexedPAFAdapter/index.ts'

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
