import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { RemoteAbortSignal } from '@jbrowse/core/rpc/remoteAbortSignals'
import { SnapshotIn } from 'mobx-state-tree'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { indexTracks } from '@jbrowse/text-indexing'

export class IndexTracksRpcMethod extends RpcMethodType {
  name = 'IndexTracksRpcMethod'

  async execute(
    args: {
      sessionId: string
      signal: RemoteAbortSignal
      outLocation?: string
      attributes?: string[]
      exclude?: string[]
      assemblies?: string[]
      indexType?: string
      tracks: AnyConfigurationModel[] | SnapshotIn<AnyConfigurationModel>[]
    },
    rpcDriverClassName: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { tracks, outLocation, exclude, attributes, assemblies, indexType } =
      deserializedArgs

    const indexingParams = {
      outLocation,
      tracks,
      exclude,
      attributes,
      assemblies,
      indexType,
    }
    await indexTracks(indexingParams)
    return []
  }
}
