import {
  buildConsensusTally,
  computeConsensus,
  computeConsensusVariants,
} from '@jbrowse/alignments-core'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { checkStopTokenThrottled } from '@jbrowse/core/util/stopToken'

import { isMismatchFeature } from '../shared/extractCigarFeatures.ts'
import { fetchFeaturesFromAdapter } from '../shared/fetchFeaturesFromAdapter.ts'
import { fetchReferenceSequence } from '../shared/fetchReferenceSequence.ts'

import type { FilterBy } from '../shared/types.ts'
import type { ConsensusVariant } from '@jbrowse/alignments-core'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Region } from '@jbrowse/core/util'

interface GetConsensusSequenceArgs {
  adapterConfig: Record<string, unknown>
  // supplied by renameRegionsIfNeeded during serialization, never by a caller
  sequenceAdapter?: Record<string, unknown>
  regions: Region[]
  filterBy?: FilterBy
  minDepth?: number
  callFract?: number
  hetFract?: number
  includeInsertions?: boolean
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    GetConsensusSequence: {
      args: GetConsensusSequenceArgs
      // The caller already knows which region it asked about, and after
      // renameRegions the refName here is the adapter's, not the one it asked
      // with — so only the computed answer comes back.
      return: {
        consensus: string
        variants: ConsensusVariant[]
      }
    }
  }
}

export default class GetConsensusSequence extends RpcMethodTypeWithFiltersAndRenameRegions<'GetConsensusSequence'> {
  name = 'GetConsensusSequence' as const

  async execute(args: RpcExecuteArgs<'GetConsensusSequence'>) {
    const {
      sessionId,
      adapterConfig,
      sequenceAdapter,
      regions,
      filterBy,
      minDepth,
      callFract,
      hetFract,
      includeInsertions,
      stopToken,
      statusCallback,
    } = args

    const region = regions[0]!

    if (!sequenceAdapter) {
      throw new Error(
        'Consensus requires a reference sequence, but none is configured for this assembly',
      )
    }

    const { featuresArray, stopTokenCheck } = await fetchFeaturesFromAdapter({
      pluginManager: this.pluginManager,
      sessionId,
      adapterConfig,
      sequenceAdapter,
      region,
      filterBy,
      statusCallback,
      stopToken,
    })

    const { regionSequence, regionSequenceStart } =
      await fetchReferenceSequence({
        pluginManager: this.pluginManager,
        sessionId,
        sequenceAdapter,
        region,
        featuresArray,
      })

    if (!regionSequence) {
      throw new Error('Could not fetch reference sequence for consensus')
    }

    // Last chance to bail before the tally and the two walks, which are
    // synchronous over the whole region and can't be interrupted once started.
    checkStopTokenThrottled(stopTokenCheck)

    const reference = regionSequence.slice(region.start - regionSequenceStart)

    // Only per-base alignment features can be tallied — the same discriminator
    // the render path uses, rather than a second inline `'forEachMismatch' in f`
    // that could drift from it. `MismatchFeature` satisfies core's
    // `ConsensusFeature` structurally.
    const features = featuresArray.filter(f => isMismatchFeature(f))

    // Features are already flag-filtered at fetch time by filterBy; reuse the
    // same flagExclude here so the tally can't re-drop reads the user chose to
    // keep (e.g. secondary alignments). Falls back to the samtools-parity
    // default when called without a filterBy.
    const tally = buildConsensusTally(features, region, filterBy?.flagExclude)
    const consensusOpts = { minDepth, callFract, hetFract, includeInsertions }
    const consensus = computeConsensus(reference, tally, consensusOpts)
    const variants = computeConsensusVariants(reference, tally, consensusOpts)

    return { consensus, variants }
  }
}
