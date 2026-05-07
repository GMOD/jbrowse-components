import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import type {
  SyntenyRpcResult,
  SyntenyViewSnap,
} from './executeSyntenyFeaturesAndPositions.ts'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export interface SyntenyGetFeaturesAndPositionsArgs {
  adapterConfig: Record<string, unknown>
  viewSnaps: SyntenyViewSnap[]
  level: number
  sessionId: string
  stopToken?: StopToken
  colorBy?: string
  drawCIGAR?: boolean
  drawCIGARMatchesOnly?: boolean
  drawLocationMarkers?: boolean
  chainMerge?: boolean
  statusCallback?: (msg: string) => void
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    SyntenyGetFeaturesAndPositions: {
      args: SyntenyGetFeaturesAndPositionsArgs
      return: SyntenyRpcResult
    }
  }
}

export class SyntenyGetFeaturesAndPositions extends RpcMethodType {
  name = 'SyntenyGetFeaturesAndPositions'

  async serializeArguments(
    args: Record<string, unknown>,
    _rpcDriverClassName: string,
  ) {
    return args
  }

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
