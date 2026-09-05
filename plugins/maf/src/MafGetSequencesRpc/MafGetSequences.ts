import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { measureRegionBytes } from '@jbrowse/core/rpc/byteBudget'

import { processFeaturesToFasta } from '../util/processFeaturesToFasta.ts'

import type { BaseMafRpcArgs, Sample } from '../types.ts'
import type { FastaResult } from '../util/processFeaturesToFasta.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MafGetSequences: {
      args: MafGetSequencesArgs
      return: FastaResult | RegionTooLargeResult
    }
  }
}

export interface MafGetSequencesArgs extends BaseMafRpcArgs {
  samples: Sample[]
  showAllLetters: boolean
  includeInsertions?: boolean
}

/**
 * The widget's read of the alignment, gated like the three tiers the display
 * fetches. It is the same file and the same span, and it was the one MAF read
 * that measured nothing: `getFeaturesArray` pulled the whole span, and
 * `processFeaturesToFasta` then preallocated one byte per sample per base
 * before it looked at a feature — 2.3 GB in the worker for a 5 Mb window over
 * HPRC's 464 haplotypes, from a menu item that was offered at every zoom.
 */
export default class MafGetSequences extends RpcMethodTypeWithFiltersAndRenameRegions<'MafGetSequences'> {
  name = 'MafGetSequences' as const

  async execute(
    args: RpcExecuteArgs<'MafGetSequences'>,
  ): Promise<FastaResult | RegionTooLargeResult> {
    const {
      samples,
      regions,
      adapterConfig,
      sessionId,
      showAllLetters,
      includeInsertions,
      byteLimit,
      stopToken,
      statusCallback,
    } = args
    const dataAdapter = await getFeatureAdapterOrThrow({
      pluginManager: this.pluginManager,
      sessionId,
      adapterConfig,
    })

    const { tooLarge } = await measureRegionBytes({
      dataAdapter,
      regions,
      byteLimit,
      stopToken,
      statusCallback,
    })
    if (tooLarge) {
      return tooLarge
    }

    const features = await dataAdapter.getFeaturesArray(regions[0]!, args)
    return processFeaturesToFasta({
      features,
      samples,
      regions,
      showAllLetters,
      includeInsertions,
    })
  }
}
