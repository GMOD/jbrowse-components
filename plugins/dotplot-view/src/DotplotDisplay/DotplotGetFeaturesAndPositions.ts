import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import type { DotplotFeaturesAndPositionsResult } from './executeDotplotFeaturesAndPositions.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Region } from '@jbrowse/core/util'
import type { RpcResult } from '@jbrowse/core/util/librpc'
import type { BpIndexViewSnap } from '@jbrowse/synteny-core'

export interface DotplotGetFeaturesAndPositionsArgs {
  adapterConfig: Record<string, unknown>
  regions: Region[]
  hViewSnap: BpIndexViewSnap
  vViewSnap: BpIndexViewSnap
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

export class DotplotGetFeaturesAndPositions extends RpcMethodType<
  'DotplotGetFeaturesAndPositions',
  RpcResult<DotplotFeaturesAndPositionsResult>
> {
  name = 'DotplotGetFeaturesAndPositions' as const

  async execute(args: RpcExecuteArgs<'DotplotGetFeaturesAndPositions'>) {
    const { executeDotplotFeaturesAndPositions } =
      await import('./executeDotplotFeaturesAndPositions.ts')
    return executeDotplotFeaturesAndPositions({
      ...args,
      pluginManager: this.pluginManager,
    })
  }
}
