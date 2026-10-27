import BlastTabularAdapterF from './BlastTabularAdapter/index.ts'
import ChainAdapterF from './ChainAdapter/index.ts'
import DeltaAdapterF from './DeltaAdapter/index.ts'
import MCScanAnchorsAdapterF from './MCScanAnchorsAdapter/index.ts'
import MCScanBlocksAdapterF from './MCScanBlocksAdapter/index.ts'
import MCScanSimpleAnchorsAdapterF from './MCScanSimpleAnchorsAdapter/index.ts'
import MashMapAdapterF from './MashMapAdapter/index.ts'
import MultiGenomeIndexedPAFAdapterF from './MultiGenomeIndexedPAFAdapter/index.ts'
import MultiGenomePAFAdapterF from './MultiGenomePAFAdapter/index.ts'
import MultiPairwiseSyntenyAdapterF from './MultiPairwiseSyntenyAdapter/index.ts'
import PAFAdapterF from './PAFAdapter/index.ts'
import PairwiseIndexedPAFAdapterF from './PairwiseIndexedPAFAdapter/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * Registers every comparative adapter, and none of the plugin's UI, for a host
 * that reads synteny tables through `@jbrowse/tables`.
 */
export function registerComparativeAdapters(pluginManager: PluginManager) {
  MultiGenomePAFAdapterF(pluginManager)
  MultiGenomeIndexedPAFAdapterF(pluginManager)
  PAFAdapterF(pluginManager)
  PairwiseIndexedPAFAdapterF(pluginManager)
  MultiPairwiseSyntenyAdapterF(pluginManager)
  DeltaAdapterF(pluginManager)
  ChainAdapterF(pluginManager)
  MCScanAnchorsAdapterF(pluginManager)
  MCScanBlocksAdapterF(pluginManager)
  MCScanSimpleAnchorsAdapterF(pluginManager)
  MashMapAdapterF(pluginManager)
  BlastTabularAdapterF(pluginManager)
}
