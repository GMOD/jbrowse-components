import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { RemoteAbortSignal } from '@jbrowse/core/rpc/remoteAbortSignals'
import { checkAbortSignal } from '@jbrowse/core/util'
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
    const {
      tracks,
      outLocation,
      exclude,
      attributes,
      assemblies,
      indexType,
      signal,
      statusCallback,
    } = await this.deserializeArguments(args, rpcDriverClassName)

    checkAbortSignal(signal)
    await indexTracks({
      outDir: outLocation,
      tracks,
      featureTypesToExclude: exclude,
      attributesToIndex: attributes,
      assemblyNames: assemblies,
      indexType,
      statusCallback,
      signal,
    })
  }
}
