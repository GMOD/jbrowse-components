import {
  buildConsensusTally,
  computeConsensus,
  computeConsensusVariants,
} from '@jbrowse/alignments-core'
import { checkAbortSignal } from '@jbrowse/core/util/aborting'

import { flagMasksOf } from '../shared/alignmentsFilter.ts'
import { isMismatchFeature } from '../shared/extractCigarFeatures.ts'
import { fetchFeaturesFromAdapter } from '../shared/fetchFeaturesFromAdapter.ts'
import { fetchReferenceSequence } from '../shared/fetchReferenceSequence.ts'
import { filterChainFeatures } from './filterChainFeatures.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

export async function executeGetConsensusSequence({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RpcExecuteArgs<'GetConsensusSequence'>
}) {
  const {
    sessionId,
    adapterConfig,
    sequenceAdapter,
    regions,
    filter,
    pinnedInsertSizeBand,
    minDepth,
    callFract,
    hetFract,
    includeInsertions,
    signal,
    statusCallback,
  } = args

  const region = regions[0]!

  if (!sequenceAdapter) {
    throw new Error(
      'Consensus requires a reference sequence, but none is configured for this assembly',
    )
  }

  const { featuresArray } = await fetchFeaturesFromAdapter({
    pluginManager,
    sessionId,
    adapterConfig,
    sequenceAdapter,
    region,
    filter,
    statusCallback,
    signal,
  })

  const { regionSequence, regionSequenceStart } = await fetchReferenceSequence({
    pluginManager,
    sessionId,
    sequenceAdapter,
    region,
    featuresArray,
    signal,
  })

  if (!regionSequence) {
    throw new Error('Could not fetch reference sequence for consensus')
  }

  // Last chance to bail before the tally and the two walks, which are
  // synchronous over the whole region and can't be interrupted once started.
  checkAbortSignal(signal)

  const reference = regionSequence.slice(region.start - regionSequenceStart)

  // Only per-base alignment features can be tallied — the same discriminator
  // the render path uses, rather than a second inline `'forEachMismatch' in f`
  // that could drift from it. `MismatchFeature` satisfies core's
  // `ConsensusFeature` structurally. The read-category filters go first, as
  // they do for the pileup, so the tally is over the reads on screen.
  const features = filterChainFeatures(
    featuresArray,
    filter,
    pinnedInsertSizeBand,
  ).filter(f => isMismatchFeature(f))

  // Features are already flag-filtered at fetch time by `filter`; reuse its
  // excluded flags here so the tally can't re-drop reads the user chose to
  // keep (e.g. secondary alignments). Falls back to the samtools-parity
  // default when called without a `filter`.
  const tally = buildConsensusTally(
    features,
    region,
    filter && flagMasksOf(filter).exclude,
  )
  const consensusOpts = { minDepth, callFract, hetFract, includeInsertions }
  const consensus = computeConsensus(reference, tally, consensusOpts)
  const variants = computeConsensusVariants(reference, tally, consensusOpts)

  return { consensus, variants }
}
