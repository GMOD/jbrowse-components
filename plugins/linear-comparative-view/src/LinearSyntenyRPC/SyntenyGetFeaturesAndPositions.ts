import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import type {
  SyntenyRpcResult,
  executeSyntenyFeaturesAndPositions,
} from './executeSyntenyFeaturesAndPositions.ts'
import type {
  RpcCallContext,
  RpcExecuteArgs,
} from '@jbrowse/core/rpc/RpcRegistry'

// No color: the worker emits per-instance kinds and the display colors them on
// the main thread, so neither a color change nor the location-marker toggle
// reaches this RPC. `cigarMode` does, because it gates the CIGAR parse.
export type SyntenyGetFeaturesAndPositionsArgs = Omit<
  Parameters<typeof executeSyntenyFeaturesAndPositions>[0],
  'pluginManager' | keyof RpcCallContext
>

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    SyntenyGetFeaturesAndPositions: {
      args: SyntenyGetFeaturesAndPositionsArgs
      return: SyntenyRpcResult
      // wrapped in rpcResult so postMessage transfers its buffers
      transferables: true
    }
  }
}

export class SyntenyGetFeaturesAndPositions extends RpcMethodType<'SyntenyGetFeaturesAndPositions'> {
  name = 'SyntenyGetFeaturesAndPositions' as const

  override preload() {
    return import('./executeSyntenyFeaturesAndPositions.ts')
  }

  async execute(args: RpcExecuteArgs<'SyntenyGetFeaturesAndPositions'>) {
    const { executeSyntenyFeaturesAndPositions } = await this.preload()
    return executeSyntenyFeaturesAndPositions({
      ...args,
      pluginManager: this.pluginManager,
    })
  }
}
