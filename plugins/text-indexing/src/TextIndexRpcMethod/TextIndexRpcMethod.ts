import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { checkAbortSignal } from '@jbrowse/core/util/aborting'
import { indexTracks } from '@jbrowse/text-indexing'

import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { indexType } from '@jbrowse/text-indexing'
import type { IndexingPolicy, Track } from '@jbrowse/text-indexing-core'

// No `signal` and no `statusCallback`: both come from `RpcHandles`, which
// every method's args carry. Declaring the status one here narrowed it to
// `(message: string) => void` — a channel that cannot carry a determinate
// fraction, so the indexer could only ever say what it was doing and never how
// far in it was, on the one operation in the app that runs for minutes.
interface TextIndexRpcMethodArgs {
  outLocation: string
  policy?: IndexingPolicy
  assemblies?: string[]
  indexType?: indexType
  tracks: Track[]
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    TextIndexRpcMethod: {
      args: TextIndexRpcMethodArgs
      return: void
    }
  }
}

export class TextIndexRpcMethod extends RpcMethodType<'TextIndexRpcMethod'> {
  name = 'TextIndexRpcMethod' as const

  async execute(args: RpcExecuteArgs<'TextIndexRpcMethod'>) {
    const {
      tracks,
      outLocation,
      policy,
      assemblies,
      indexType,
      signal,
      statusCallback,
    } = args

    checkAbortSignal(signal)
    await indexTracks({
      outDir: outLocation,
      tracks,
      policy,
      assemblyNames: assemblies,
      indexType,
      statusCallback,
      signal,
    })
  }
}
