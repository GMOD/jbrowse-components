import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { RemoteAbortSignal } from '@jbrowse/core/rpc/remoteAbortSignals'
import { indexTracks, indexType, Track } from '@jbrowse/text-indexing'

export class TextIndexRpcMethod extends RpcMethodType {
  name = 'TextIndexRpcMethod'

  async execute(
    args: {
      sessionId: string
      signal?: RemoteAbortSignal
      outLocation?: string
      attributes?: string[]
      exclude?: string[]
      assemblies?: string[]
      indexType?: indexType
      tracks: Track[]
      statusCallback: (message: string) => void
    },
    rpcDriverClassName: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const {
      tracks,
      outLocation,
      exclude,
      attributes,
      assemblies,
      indexType,
      signal,
      statusCallback,
    } = deserializedArgs

    console.log('RPC', signal)
    const indexingParams = {
      outLocation,
      tracks,
      exclude,
      attributes,
      assemblies,
      indexType,
      statusCallback,
      signal,
    }
    await indexTracks(indexingParams)
    statusCallback('')
    return []
  }
}
