import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { checkStopToken } from '@jbrowse/core/util/stopToken'
import { indexTracks } from '@jbrowse/text-indexing'
import type { indexType, Track } from '@jbrowse/text-indexing'

export class TextIndexRpcMethod extends RpcMethodType {
  name = 'TextIndexRpcMethod'

  async execute(
    args: {
      sessionId: string
      stopToken?: string
      outLocation?: string
      attributes?: string[]
      exclude?: string[]
      assemblies?: string[]
      indexType?: indexType
      tracks: Track[]
      statusCallback: (message: string) => void
    },
    _rpcDriverClassName: string,
  ) {
    const {
      tracks,
      outLocation,
      exclude,
      attributes,
      assemblies,
      indexType,
      stopToken,
      statusCallback,
    } = args

    checkStopToken(stopToken)
    await indexTracks({
      outDir: outLocation,
      tracks,
      featureTypesToExclude: exclude,
      attributesToIndex: attributes,
      assemblyNames: assemblies,
      indexType,
      statusCallback,
      stopToken,
    })
  }
}
