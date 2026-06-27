import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import { processFeaturesToFasta } from '../util/processFeaturesToFasta.ts'

import type { BaseMafRpcArgs, Sample } from '../types.ts'
import type { FastaResult } from '../util/processFeaturesToFasta.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

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
    const dataAdapter = (
      await getAdapter(this.pluginManager, sessionId, adapterConfig)
    ).dataAdapter as BaseFeatureDataAdapter

    const features = await dataAdapter.getFeaturesArray(
      regions[0]!,
      deserializedArgs,
    )
    return processFeaturesToFasta({
      features: new Map(features.map(f => [f.id(), f])),
      samples,
      regions,
      showAllLetters,
      includeInsertions,
    })
  }
}
