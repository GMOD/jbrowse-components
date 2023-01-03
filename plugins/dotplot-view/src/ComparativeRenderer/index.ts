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

  async renameRegionsIfNeeded(args: RenderArgs, rend: ComparativeRenderer) {
    return rend.renameRegionsIfNeeded(args)
  }

  getRenderer(rendererType: string) {
    const pm = this.pluginManager
    return pm.getRendererType(rendererType) as ComparativeRenderer
  }

  async serializeArguments(args: RenderArgs, rpcDriver: string) {
    const { rendererType } = args
    const renderer = this.getRenderer(rendererType)
    const n = (await super.serializeArguments(args, rpcDriver)) as RenderArgs
    const result = await this.renameRegionsIfNeeded(n, renderer)

    return rpcDriver === 'MainThreadRpcDriver'
      ? result
      : renderer.serializeArgsInClient(result)
  }

  async execute(
    args: RenderArgsSerialized & { signal?: RemoteAbortSignal },
    rpcDriver: string,
  ) {
    let deserializedArgs = args
    if (rpcDriver !== 'MainThreadRpcDriver') {
      deserializedArgs = await this.deserializeArguments(args, rpcDriver)
    }
    const { sessionId, rendererType, signal } = deserializedArgs
    if (!sessionId) {
      throw new Error('must pass a unique session id')
    }

    checkAbortSignal(signal)

    const renderer = this.getRenderer(rendererType)
    return rpcDriver === 'MainThreadRpcDriver'
      ? renderer.render(deserializedArgs)
      : renderer.renderInWorker(deserializedArgs)
  }

  async deserializeReturn(
    val: RenderResults | ResultsSerialized,
    args: RenderArgs,
    rpcDriver: string,
  ): Promise<unknown> {
    const ret = (await super.deserializeReturn(
      val,
      args,
      rpcDriver,
    )) as ResultsSerialized
    if (rpcDriver === 'MainThreadRpcDriver') {
      return ret
    }

    const renderer = this.getRenderer(args.rendererType)
    return renderer.deserializeResultsInClient(ret, args)
  }
}
