import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import { processFeaturesToFasta } from '../util/processFeaturesToFasta.ts'

import type { BaseMafRpcArgs, Sample } from '../types.ts'
import type { FastaResult } from '../util/processFeaturesToFasta.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MafGetSequences: {
      args: MafGetSequencesArgs
      return: FastaResult
    }
  }
}

export interface MafGetSequencesArgs extends BaseMafRpcArgs {
  samples: Sample[]
  showAllLetters: boolean
  includeInsertions?: boolean
}

export default class MafGetSequences extends RpcMethodTypeWithFiltersAndRenameRegions<'MafGetSequences'> {
  name = 'MafGetSequences' as const

  async execute(args: RpcExecuteArgs<'MafGetSequences'>): Promise<FastaResult> {
    const {
      samples,
      regions,
      adapterConfig,
      sessionId,
      showAllLetters,
      includeInsertions,
    } = args
    const dataAdapter = await getFeatureAdapterOrThrow({
      pluginManager: this.pluginManager,
      sessionId,
      adapterConfig,
    })

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
