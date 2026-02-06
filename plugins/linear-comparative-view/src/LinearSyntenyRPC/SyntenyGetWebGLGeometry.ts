import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import type { SyntenyFeatureData } from './executeSyntenyWebGLGeometry.ts'
import type { ViewSnap } from '@jbrowse/core/util'

export class SyntenyGetWebGLGeometry extends RpcMethodType {
  name = 'SyntenyGetWebGLGeometry'

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
    const { executeSyntenyWebGLGeometry } = await import(
      './executeSyntenyWebGLGeometry.ts'
    )
    return executeSyntenyWebGLGeometry(deserializedArgs)
  }
}
