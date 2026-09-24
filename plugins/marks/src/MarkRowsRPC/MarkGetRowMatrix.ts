import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'
import { rpcResultWithArrayBuffers } from '@jbrowse/core/util/librpc'

import type { MarkRowMatrixArgs } from './rpcTypes.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MarkGetRowMatrix: {
      args: MarkRowMatrixArgs
      return: Map<string, Float32Array<ArrayBuffer>>
      transferables: true
    }
  }
}

export default class MarkGetRowMatrix extends RpcMethodTypeWithRenameRegions<'MarkGetRowMatrix'> {
  name = 'MarkGetRowMatrix' as const

  async execute(args: RpcExecuteArgs<'MarkGetRowMatrix'>) {
    const { collectMarkRowMatrix } = await import('./collectMarkRowMatrix.ts')
    return rpcResultWithArrayBuffers(
      await collectMarkRowMatrix({ pluginManager: this.pluginManager, args }),
    )
  }
}
