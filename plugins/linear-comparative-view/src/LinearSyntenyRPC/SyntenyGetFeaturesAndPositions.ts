import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import type {
  SyntenyQueryViewSnap,
  SyntenyRpcResult,
  SyntenyTargetViewSnap,
} from './executeSyntenyFeaturesAndPositions.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { RpcResult } from '@jbrowse/core/util/librpc'

export interface SyntenyGetFeaturesAndPositionsArgs {
  adapterConfig: Record<string, unknown>
  // The two adjacent genome views this synteny level connects, with refNames
  // already renamed into the adapter's namespace on the main thread.
  queryView: SyntenyQueryViewSnap
  targetView: SyntenyTargetViewSnap
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

export class SyntenyGetFeaturesAndPositions extends RpcMethodType<
  'SyntenyGetFeaturesAndPositions',
  RpcResult<SyntenyRpcResult>
> {
  name = 'SyntenyGetFeaturesAndPositions' as const

  async execute(args: RpcExecuteArgs<'SyntenyGetFeaturesAndPositions'>) {
    const { executeSyntenyFeaturesAndPositions } =
      await import('./executeSyntenyFeaturesAndPositions.ts')
    return executeSyntenyFeaturesAndPositions({
      ...args,
      pluginManager: this.pluginManager,
    })
  }
}
