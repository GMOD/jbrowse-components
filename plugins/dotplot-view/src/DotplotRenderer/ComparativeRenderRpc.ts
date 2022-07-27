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

  async renameRegionsIfNeeeded(args: RenderArgs, rend: ComparativeRenderer) {
    return rend.renameRegionsIfNeeded(args)
  }

  getRenderer(rendererType: string) {
    return this.pluginManager.getRendererType(
      rendererType,
    ) as ComparativeRenderer
  }

  async serializeArguments(args: RenderArgs, rpcDriverClassName: string) {
    const { rendererType } = args
    const renderer = this.getRenderer(rendererType)
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

    const renderer = this.getRenderer(rendererType)
    return rpcDriverClassName === 'MainThreadRpcDriver'
      ? renderer.render(deserializedArgs)
      : renderer.renderInWorker(deserializedArgs)
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

    return this.getRenderer(args.rendererType).deserializeResultsInClient(
      superDeserialized as ResultsSerialized,
      args,
    )
  }
}
