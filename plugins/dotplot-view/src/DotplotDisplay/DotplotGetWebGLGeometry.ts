import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import type {
  DotplotWebGLGeometryArgs,
  DotplotWebGLGeometryResult,
} from './types.ts'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    DotplotGetWebGLGeometry: {
      args: DotplotWebGLGeometryArgs
      return: DotplotWebGLGeometryResult
    }
  }
}

export class DotplotGetWebGLGeometry extends RpcMethodType {
  name = 'DotplotGetWebGLGeometry'

  async execute(args: DotplotWebGLGeometryArgs, rpcDriverClassName: string) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { executeDotplotWebGLGeometry } =
      await import('./executeDotplotWebGLGeometry.ts')
    return executeDotplotWebGLGeometry(deserializedArgs)
  }
}
