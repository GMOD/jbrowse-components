import { checkAbortSignal, renameRegionsIfNeeded } from '@jbrowse/core/util'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import ComparativeServerSideRendererType, {
  RenderArgs as ComparativeRenderArgs,
  RenderArgsSerialized as ComparativeRenderArgsSerialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/ComparativeServerSideRendererType'
import { RemoteAbortSignal } from '@jbrowse/core/rpc/remoteAbortSignals'

interface RenderArgs extends ComparativeRenderArgs {
  adapterConfig: {}
}

interface RenderArgsSerialized extends ComparativeRenderArgsSerialized {
  adapterConfig: {}
  rendererType: string
}

/**
 * call a synteny renderer with the given args
 * param views: a set of views that each contain a set of regions
 * used instead of passing regions directly as in render()
 */
export default class ComparativeRender extends RpcMethodType {
  name = 'ComparativeRender'

  async serializeArguments(args: RenderArgs) {
    const assemblyManager = this.pluginManager.rootModel?.session
      ?.assemblyManager
    if (!assemblyManager) {
      return args
    }

    return renameRegionsIfNeeded(assemblyManager, args)
  }

  async execute(
    args: RenderArgsSerialized & { signal?: RemoteAbortSignal },
    rpcDriverClassName: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { sessionId, adapterConfig, rendererType, signal } = deserializedArgs
    if (!sessionId) throw new Error('must pass a unique session id')

    checkAbortSignal(signal)

    const { dataAdapter } = getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    if (!(dataAdapter instanceof BaseFeatureDataAdapter))
      throw new Error(
        `ComparativeRender cannot handle this type of data adapter ${dataAdapter}`,
      )

    const RendererType = this.pluginManager.getRendererType(rendererType)

    if (!RendererType) {
      throw new Error(`renderer "${rendererType}" not found`)
    }
    if (!RendererType.ReactComponent) {
      throw new Error(
        `renderer ${rendererType} has no ReactComponent, it may not be completely implemented yet`,
      )
    }

    if (!(RendererType instanceof ComparativeServerSideRendererType))
      throw new Error(
        'CoreRender requires a renderer that is a subclass of ServerSideRendererType',
      )

    const renderArgs = {
      ...deserializedArgs,
      dataAdapter,
    }

    const result = await RendererType.renderInWorker(renderArgs)
    checkAbortSignal(signal)
    return result
  }
}
