import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import { clusterData } from './cluster'
import { getGenotypeMatrix } from './getGenotypeMatrix'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'

export class MultiVariantClusterGenotypeMatrix extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'MultiVariantClusterGenotypeMatrix'

  async execute(
    args: {
      adapterConfig: AnyConfigurationModel
      stopToken?: string
      statusCallback: (arg: string) => void
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
    const matrix = await getGenotypeMatrix({
      pluginManager: this.pluginManager,
      args: deserializedArgs,
    })
    return clusterData({
      data: Object.values(matrix),
      onProgress: a => deserializedArgs.statusCallback?.(`${toP(a * 100)}%`),
    })
  }
}

function toP(n: number) {
  return Number.parseFloat(n.toPrecision(3))
}
