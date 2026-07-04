import Plugin from '@jbrowse/core/Plugin'

import AllVsAllAddTrackComponentF from './AllVsAllAddTrackComponent/index.tsx'
import AllVsAllPAFAdapterF from './AllVsAllPAFAdapter/index.ts'
import BlastTabularAdapterF from './BlastTabularAdapter/index.ts'
import ChainAdapterF from './ChainAdapter/index.ts'
import ComparativeAddTrackComponentF from './ComparativeAddTrackComponent/index.tsx'
import DeltaAdapterF from './DeltaAdapter/index.ts'
import GuessAdapterF from './GuessAdapter/index.ts'
import MCScanAddTrackComponentF from './MCScanAddTrackComponent/index.tsx'
import MCScanAnchorsAdapterF from './MCScanAnchorsAdapter/index.ts'
import MCScanBlocksAdapterF from './MCScanBlocksAdapter/index.ts'
import MCScanBlocksAddTrackComponentF from './MCScanBlocksAddTrackComponent/index.tsx'
import MCScanSimpleAnchorsAdapterF from './MCScanSimpleAnchorsAdapter/index.ts'
import MashMapAdapterF from './MashMapAdapter/index.ts'
import PAFAdapterF from './PAFAdapter/index.ts'
import PairwiseIndexedPAFAdapterF from './PairwiseIndexedPAFAdapter/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class ComparativeAdaptersPlugin extends Plugin {
  name = 'ComparativeAdaptersPlugin'

  install(pluginManager: PluginManager) {
    AllVsAllPAFAdapterF(pluginManager)
    PAFAdapterF(pluginManager)
    PairwiseIndexedPAFAdapterF(pluginManager)
    DeltaAdapterF(pluginManager)
    ChainAdapterF(pluginManager)
    MCScanAnchorsAdapterF(pluginManager)
    MCScanBlocksAdapterF(pluginManager)
    MCScanSimpleAnchorsAdapterF(pluginManager)
    MashMapAdapterF(pluginManager)
    BlastTabularAdapterF(pluginManager)
    ComparativeAddTrackComponentF(pluginManager)
    MCScanAddTrackComponentF(pluginManager)
    MCScanBlocksAddTrackComponentF(pluginManager)
    AllVsAllAddTrackComponentF(pluginManager)
    GuessAdapterF(pluginManager)
  }
}
