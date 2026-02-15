import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import type { SyntenyFeatureData } from './executeSyntenyWebGLGeometry.ts'
import type { ViewSnap } from '@jbrowse/core/util'

export class SyntenyGetWebGLGeometry extends RpcMethodType {
  name = 'SyntenyGetWebGLGeometry'

  // Skip the expensive augmentLocationObjects deep-walk. This RPC only
  // passes plain feature data and minimal view snapshots, no file
  // locations that need auth augmentation or blob mapping.
  async serializeArguments(
    args: Record<string, unknown>,
    _rpcDriverClassName: string,
  ) {
    return args
  }

  async execute(
    args: {
      features: SyntenyFeatureData[]
      viewSnaps: ViewSnap[]
      level: number
      sessionId: string
    },
    rpcDriverClassName: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { executeSyntenyWebGLGeometry } =
      await import('./executeSyntenyWebGLGeometry.ts')
    return executeSyntenyWebGLGeometry(deserializedArgs)
  }
}
