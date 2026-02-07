import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import type { DotplotFeatureData } from './types.ts'
import type { ViewSnap } from '@jbrowse/core/util'

export class DotplotGetWebGLGeometry extends RpcMethodType {
  name = 'DotplotGetWebGLGeometry'

  async execute(
    args: {
      features: DotplotFeatureData[]
      hViewSnap: ViewSnap
      vViewSnap: ViewSnap
      sessionId: string
    },
    rpcDriverClassName: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { executeDotplotWebGLGeometry } = await import(
      './executeDotplotWebGLGeometry.ts'
    )
    return executeDotplotWebGLGeometry(deserializedArgs)
  }
}
