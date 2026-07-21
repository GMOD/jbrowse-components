import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import {
  buildConsensusTally,
  computeConsensus,
  computeConsensusVariants,
} from '@jbrowse/alignments-core'

import { fetchFeaturesFromAdapter } from '../shared/fetchFeaturesFromAdapter.ts'
import { fetchReferenceSequence } from '../shared/fetchReferenceSequence.ts'

import type { FilterBy } from '../shared/types.ts'
import type { ConsensusFeature, ConsensusVariant } from '@jbrowse/alignments-core'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

interface GetConsensusSequenceArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  sequenceAdapter?: Record<string, unknown>
  regions: Region[]
  filterBy?: FilterBy
  minDepth?: number
  callFract?: number
  includeInsertions?: boolean
  stopToken?: StopToken
  rpcDriverName?: string
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    GetConsensusSequence: {
      args: GetConsensusSequenceArgs
      return: {
        consensus: string
        variants: ConsensusVariant[]
        refName: string
        start: number
        end: number
      }
    }
  }
}

export default class GetConsensusSequence extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'GetConsensusSequence'

  async execute(args: GetConsensusSequenceArgs, _rpcDriver: string) {
    const {
      sessionId,
      adapterConfig,
      sequenceAdapter,
      regions,
      filterBy,
      minDepth,
      callFract,
      includeInsertions,
      stopToken,
    } = args

    const region = regions[0]!

    if (!sequenceAdapter) {
      throw new Error(
        'Consensus requires a reference sequence, but none is configured for this assembly',
      )
    }

    const { featuresArray } = await fetchFeaturesFromAdapter({
      pluginManager: this.pluginManager,
      sessionId,
      adapterConfig,
      sequenceAdapter,
      region,
      filterBy,
      statusCallback: () => {},
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

    const reference = regionSequence.slice(region.start - regionSequenceStart)

    const features = featuresArray.filter(
      (f): f is typeof f & ConsensusFeature => 'forEachMismatch' in f,
    )

    const tally = buildConsensusTally(features, region)
    const consensusOpts = { minDepth, callFract, includeInsertions }
    const consensus = computeConsensus(reference, tally, consensusOpts)
    const variants = computeConsensusVariants(reference, tally, consensusOpts)

    return {
      consensus,
      variants,
      refName: region.refName,
      start: region.start,
      end: region.end,
    }
  }
}
