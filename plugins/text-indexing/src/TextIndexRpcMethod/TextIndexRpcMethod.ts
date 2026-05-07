import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { checkStopToken } from '@jbrowse/core/util/stopToken'
import { indexTracks } from '@jbrowse/text-indexing'

import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Track, indexType } from '@jbrowse/text-indexing'

interface TextIndexRpcMethodArgs {
  sessionId: string
  stopToken?: StopToken
  outLocation?: string
  attributes?: string[]
  exclude?: string[]
  assemblies?: string[]
  indexType?: indexType
  tracks: Track[]
  statusCallback: (message: string) => void
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    TextIndexRpcMethod: {
      args: TextIndexRpcMethodArgs
      return: undefined
    }
  }
}

export class TextIndexRpcMethod extends RpcMethodType {
  name = 'TextIndexRpcMethod'

  async execute(args: TextIndexRpcMethodArgs, _rpcDriverClassName: string) {
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
