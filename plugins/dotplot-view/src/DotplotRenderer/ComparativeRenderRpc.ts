import { checkAbortSignal } from '@jbrowse/core/util'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import ComparativeRenderer, {
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

  async renameRegionsIfNeeeded(
    args: RenderArgs,
    renderer: ComparativeRenderer,
  ) {
    return renderer.renameRegionsIfNeeded(args)
  }

  async serializeArguments(args: RenderArgs, rpcDriverClassName: string) {
    const { rendererType } = args
    const renderer = this.pluginManager.getRendererType(
      rendererType,
    ) as ComparativeRenderer

    const result = await this.renameRegionsIfNeeeded(
      (await super.serializeArguments(args, rpcDriverClassName)) as RenderArgs,
      renderer,
    )

    return rpcDriverClassName === 'MainThreadRpcDriver'
      ? result
      : renderer.serializeArgsInClient(result)
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
    const { sessionId, rendererType, signal } = deserializedArgs
    if (!sessionId) {
      throw new Error('must pass a unique session id')
    }

    checkAbortSignal(signal)

    const RendererType = this.pluginManager.getRendererType(
      rendererType,
    ) as ComparativeRenderer

    if (!RendererType) {
      throw new Error(`renderer "${rendererType}" not found`)
    }
    if (!RendererType.ReactComponent) {
      throw new Error(
        `renderer ${rendererType} has no ReactComponent, it may not be completely implemented yet`,
      )
    }

    const result =
      rpcDriverClassName === 'MainThreadRpcDriver'
        ? await RendererType.render(deserializedArgs)
        : await RendererType.renderInWorker(deserializedArgs)
    checkAbortSignal(signal)
    return result
  }

  async deserializeReturn(
    serializedReturn: RenderResults | ResultsSerialized,
    args: RenderArgs,
    rpcDriverClassName: string,
  ): Promise<unknown> {
    const superDeserialized = await super.deserializeReturn(
      serializedReturn,
      args,
      rpcDriverClassName,
    )
    if (rpcDriverClassName === 'MainThreadRpcDriver') {
      return superDeserialized
    }

    const { rendererType } = args
    const RendererType = this.pluginManager.getRendererType(
      rendererType,
    ) as ComparativeRenderer
    if (!RendererType) {
      throw new Error(`renderer "${rendererType}" not found`)
    }
    if (!RendererType.ReactComponent) {
      throw new Error(
        `renderer ${rendererType} has no ReactComponent, it may not be completely implemented yet`,
      )
    }

    return RendererType.deserializeResultsInClient(
      superDeserialized as ResultsSerialized,
      args,
    )
  }
}
