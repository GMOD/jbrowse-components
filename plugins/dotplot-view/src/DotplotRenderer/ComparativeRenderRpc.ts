import { checkAbortSignal, renameRegionsIfNeeded } from '@jbrowse/core/util'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import ComparativeServerSideRendererType, {
  RenderArgs as ComparativeRenderArgs,
  RenderArgsSerialized as ComparativeRenderArgsSerialized,
  RenderResults,
  ResultsSerialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/ComparativeServerSideRendererType'
import { RemoteAbortSignal } from '@jbrowse/core/rpc/remoteAbortSignals'

interface RenderArgs extends ComparativeRenderArgs {
  adapterConfig: {}
  rendererType: string
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

  async serializeArguments(args: RenderArgs, rpcDriverClassName: string) {
    const assemblyManager = this.pluginManager.rootModel?.session
      ?.assemblyManager
    const renamedArgs = assemblyManager
      ? await renameRegionsIfNeeded(assemblyManager, args)
      : args

    if (rpcDriverClassName === 'MainThreadRpcDriver') {
      return renamedArgs
    }

    const { rendererType } = args

    const RendererType = this.pluginManager.getRendererType(rendererType)

    if (!(RendererType instanceof ComparativeServerSideRendererType)) {
      throw new Error(
        'CoreRender requires a renderer that is a subclass of ServerSideRendererType',
      )
    }

    return RendererType.serializeArgsInClient(renamedArgs)
  }

  async execute(
    args: RenderArgsSerialized & { signal?: RemoteAbortSignal },
    rpcDriverClassName: string,
  ) {
    let deserializedArgs = args
    if (rpcDriverClassName !== 'MainThreadRpcDriver') {
      deserializedArgs = await this.deserializeArguments(
        args,
        rpcDriverClassName,
      )
    }
    const { sessionId, adapterConfig, rendererType, signal } = deserializedArgs
    if (!sessionId) {
      throw new Error('must pass a unique session id')
    }

    checkAbortSignal(signal)

    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    if (!(dataAdapter instanceof BaseFeatureDataAdapter)) {
      throw new Error(
        `ComparativeRender cannot handle this type of data adapter ${dataAdapter}`,
      )
    }

    const RendererType = this.pluginManager.getRendererType(rendererType)

    if (!RendererType) {
      throw new Error(`renderer "${rendererType}" not found`)
    }
    if (!RendererType.ReactComponent) {
      throw new Error(
        `renderer ${rendererType} has no ReactComponent, it may not be completely implemented yet`,
      )
    }

    if (!(RendererType instanceof ComparativeServerSideRendererType)) {
      throw new Error(
        'CoreRender requires a renderer that is a subclass of ServerSideRendererType',
      )
    }

    const renderArgs = {
      ...deserializedArgs,
      dataAdapter,
    }

    const result =
      rpcDriverClassName === 'MainThreadRpcDriver'
        ? await RendererType.render(renderArgs)
        : await RendererType.renderInWorker(renderArgs)
    checkAbortSignal(signal)
    return result
  }

  async deserializeReturn(
    serializedReturn: RenderResults | ResultsSerialized,
    args: RenderArgs,
    rpcDriverClassName: string,
  ): Promise<unknown> {
    if (rpcDriverClassName === 'MainThreadRpcDriver') {
      return serializedReturn
    }

    const { rendererType } = args
    const RendererType = this.pluginManager.getRendererType(rendererType)
    if (!RendererType) {
      throw new Error(`renderer "${rendererType}" not found`)
    }
    if (!RendererType.ReactComponent) {
      throw new Error(
        `renderer ${rendererType} has no ReactComponent, it may not be completely implemented yet`,
      )
    }
    if (!(RendererType instanceof ComparativeServerSideRendererType)) {
      throw new Error(
        'CoreRender requires a renderer that is a subclass of ServerSideRendererType',
      )
    }
    return RendererType.deserializeResultsInClient(
      serializedReturn as ResultsSerialized,
      args,
    )
  }
}
