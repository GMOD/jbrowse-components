import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { firstValueFrom, toArray } from 'rxjs'

import { processFeaturesToFasta } from '../util/fastaUtils.ts'

import type { Sample } from '../types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MafGetSequences: {
      args: MafGetSequencesArgs
      return: string[]
    }
  }
}

export interface MafGetSequencesArgs {
  sessionId: string
  adapterConfig: AnyConfigurationModel
  samples: Sample[]
  regions: Region[]
  showAllLetters: boolean
  includeInsertions?: boolean
  stopToken?: StopToken
  headers?: Record<string, string>
}

export default class MafGetSequences extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'MafGetSequences'

  async execute(
    args: MafGetSequencesArgs,
    rpcDriverClassName: string,
  ): Promise<string[]> {
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

    const features = await firstValueFrom(
      dataAdapter.getFeatures(regions[0]!, deserializedArgs).pipe(toArray()),
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
