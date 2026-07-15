import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import { processFeaturesToFasta } from '../util/processFeaturesToFasta.ts'

import type { BaseMafRpcArgs, Sample } from '../types.ts'
import type { FastaResult } from '../util/processFeaturesToFasta.ts'

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

export default class MafGetSequences extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'MafGetSequences'

  async execute(
    args: MafGetSequencesArgs,
    rpcDriverClassName: string,
  ): Promise<FastaResult> {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const {
      samples,
      regions,
      adapterConfig,
      sessionId,
      showAllLetters,
      includeInsertions,
    } = deserializedArgs
    const dataAdapter = await getFeatureAdapterOrThrow({
      pluginManager: this.pluginManager,
      sessionId,
      adapterConfig,
    })

    const features = await dataAdapter.getFeaturesArray(
      regions[0]!,
      deserializedArgs,
    )
    return processFeaturesToFasta({
      features,
      samples,
      regions,
      showAllLetters,
      includeInsertions,
    })
  }
}
