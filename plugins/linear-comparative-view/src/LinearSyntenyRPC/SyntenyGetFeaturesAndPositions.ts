import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import type { Region, ViewSnap } from '@jbrowse/core/util'

export class SyntenyGetFeaturesAndPositions extends RpcMethodType {
  name = 'SyntenyGetFeaturesAndPositions'

  async serializeArguments(
    args: Record<string, unknown>,
    _rpcDriverClassName: string,
  ) {
    return args
  }

  async execute(
    args: {
      adapterConfig: Record<string, unknown>
      regions: Region[]
      viewSnaps: ViewSnap[]
      level: number
      sessionId: string
      stopToken?: string
      colorBy?: string
      drawCurves?: boolean
      drawCIGAR?: boolean
      drawCIGARMatchesOnly?: boolean
      drawLocationMarkers?: boolean
    },
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
