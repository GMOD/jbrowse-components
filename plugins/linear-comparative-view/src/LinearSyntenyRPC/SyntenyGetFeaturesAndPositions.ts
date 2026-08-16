import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import type {
  SyntenyQueryViewSnap,
  SyntenyRpcResult,
  SyntenyTargetViewSnap,
} from './executeSyntenyFeaturesAndPositions.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

export interface SyntenyGetFeaturesAndPositionsArgs {
  adapterConfig: Record<string, unknown>
  // The two adjacent genome views this synteny level connects, with refNames
  // already renamed into the adapter's namespace on the main thread.
  queryView: SyntenyQueryViewSnap
  targetView: SyntenyTargetViewSnap
  // no colorBy: the worker emits per-instance kind/featureIdx descriptors and
  // the display recomputes colors on the main thread, so a color-scheme change
  // never reaches this RPC (see computeSyntenyColors).
  //
  // No `drawLocationMarkers` either, and for the same reason: the ticks are
  // always emitted and the toggle paints them transparent on the color lane. It
  // used to be here, which meant switching a purely visual grid on re-downloaded
  // and re-parsed the whole track to arrive at the identical features. The two
  // CIGAR flags below stay, because those genuinely change what is fetched —
  // they gate the CIGAR parse.
  drawCIGAR?: boolean
  drawCIGARMatchesOnly?: boolean
  lodMode?: BaseOptions['lodMode']
}

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

  async execute(args: RpcExecuteArgs<'SyntenyGetFeaturesAndPositions'>) {
    const { executeSyntenyFeaturesAndPositions } =
      await import('./executeSyntenyFeaturesAndPositions.ts')
    return executeSyntenyFeaturesAndPositions({
      ...args,
      pluginManager: this.pluginManager,
    })
  }
}
