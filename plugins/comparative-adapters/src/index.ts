import Plugin from '@jbrowse/core/Plugin'

import ComparativeAddTrackComponentF from './ComparativeAddTrackComponent/index.tsx'
import MCScanAddTrackComponentF from './MCScanAddTrackComponent/index.tsx'
import MCScanBlocksAddTrackComponentF from './MCScanBlocksAddTrackComponent/index.tsx'
import MultiGenomeAddTrackComponentF from './MultiGenomeAddTrackComponent/index.tsx'
import SyntenyTrackF from './SyntenyTrack/index.tsx'
import { registerComparativeAdapters } from './registerComparativeAdapters.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class ComparativeAdaptersPlugin extends Plugin {
  name = 'ComparativeAdaptersPlugin'

  install(pluginManager: PluginManager) {
    registerComparativeAdapters(pluginManager)
    ComparativeAddTrackComponentF(pluginManager)
    MCScanAddTrackComponentF(pluginManager)
    MCScanBlocksAddTrackComponentF(pluginManager)
    MultiGenomeAddTrackComponentF(pluginManager)
    // the track type every comparative adapter declares itself for; a bare base
    // track, so it needs none of the synteny views
    SyntenyTrackF(pluginManager)
  }
}
