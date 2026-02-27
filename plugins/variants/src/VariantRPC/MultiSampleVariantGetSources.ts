import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { CellDataResult } from './executeVariantCellData.ts'
import type { Source } from '../shared/types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiSampleVariantGetSources: {
      args: Record<string, unknown>
      return: Source[]
    }
    MultiSampleVariantGetCellData: {
      args: Record<string, unknown>
      return: CellDataResult
    }
    MultiSampleVariantClusterGenotypeMatrix: {
      args: Record<string, unknown>
      return: { order: number[]; tree: string }
    }
    MultiSampleVariantGetGenotypeMatrix: {
      args: Record<string, unknown>
      return: Record<string, number[]>
    }
  }
}

export class MultiSampleVariantGetSources extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'MultiSampleVariantGetSources'

  async execute(
    args: {
      adapterConfig: AnyConfigurationModel
      stopToken?: string
      sessionId: string
      headers?: Record<string, string>
      regions: Region[]
      bpPerPx: number
    },
    rpcDriverClassName: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { regions, adapterConfig, sessionId } = deserializedArgs
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )

    // @ts-expect-error
    return dataAdapter.getSources(regions, deserializedArgs)
  }
}
