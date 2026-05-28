import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import type { DotplotFeaturesAndPositionsResult } from './executeDotplotFeaturesAndPositions.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { BpIndexViewSnap } from '@jbrowse/synteny-core'

export interface DotplotGetFeaturesAndPositionsArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  regions: Region[]
  hViewSnap: BpIndexViewSnap
  vViewSnap: BpIndexViewSnap
  stopToken?: StopToken
  lodMode?: BaseOptions['lodMode']
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    DotplotGetFeaturesAndPositions: {
      args: DotplotGetFeaturesAndPositionsArgs
      return: DotplotFeaturesAndPositionsResult
    }
  }
}

export class DotplotGetFeaturesAndPositions extends RpcMethodType {
  name = 'DotplotGetFeaturesAndPositions'

  async execute(
    args: DotplotGetFeaturesAndPositionsArgs,
    rpcDriverClassName: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { executeDotplotFeaturesAndPositions } =
      await import('./executeDotplotFeaturesAndPositions.ts')
    return executeDotplotFeaturesAndPositions({
      ...deserializedArgs,
      pluginManager: this.pluginManager,
    })
  }
}
