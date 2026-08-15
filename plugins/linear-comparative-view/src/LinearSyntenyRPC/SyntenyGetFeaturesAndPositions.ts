import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import type {
  SyntenyQueryViewSnap,
  SyntenyRpcResult,
  SyntenyTargetViewSnap,
} from './executeSyntenyFeaturesAndPositions.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'

export interface SyntenyGetFeaturesAndPositionsArgs {
  adapterConfig: Record<string, unknown>
  // The two adjacent genome views this synteny level connects, with refNames
  // already renamed into the adapter's namespace on the main thread.
  queryView: SyntenyQueryViewSnap
  targetView: SyntenyTargetViewSnap
  sessionId: string
  // no colorBy: the worker emits per-instance kind/featureIdx descriptors and
  // the display recomputes colors on the main thread, so a color-scheme change
  // never reaches this RPC (see computeSyntenyColors)
  drawCIGAR?: boolean
  drawCIGARMatchesOnly?: boolean
  drawLocationMarkers?: boolean
  lodMode?: BaseOptions['lodMode']
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    SyntenyGetFeaturesAndPositions: {
      args: SyntenyGetFeaturesAndPositionsArgs
      return: SyntenyRpcResult
    }
  }
}

export class SyntenyGetFeaturesAndPositions extends RpcMethodType<'SyntenyGetFeaturesAndPositions'> {
  name = 'SyntenyGetFeaturesAndPositions' as const

  async execute(
    args: SyntenyGetFeaturesAndPositionsArgs,
    rpcDriverClassName: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { executeSyntenyFeaturesAndPositions } =
      await import('./executeSyntenyFeaturesAndPositions.ts')
    return executeSyntenyFeaturesAndPositions({
      ...deserializedArgs,
      pluginManager: this.pluginManager,
    })
  }
}
