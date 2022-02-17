import { checkAbortSignal, renameRegionsIfNeeded } from '@jbrowse/core/util'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
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
    const assemblyManager =
      this.pluginManager.rootModel?.session?.assemblyManager

    if (!assemblyManager) {
      throw new Error('No assembly maanger provided')
    }
    const renamedArgs = await renameRegionsIfNeeded(assemblyManager, args)

    const superArgs = (await super.serializeArguments(
      renamedArgs,
      rpcDriverClassName,
    )) as RenderArgs

    console.log('t1', superArgs)

    //@ts-ignore
    superArgs.view.hview.displayedRegions = (
      await renameRegionsIfNeeded(assemblyManager, {
        sessionId: superArgs.sessionId,
        //@ts-ignore
        regions: superArgs.view.hview.displayedRegions,
        adapterConfig: superArgs.adapterConfig,
      })
    ).regions
    //@ts-ignore
    superArgs.view.vview.displayedRegions = (
      await renameRegionsIfNeeded(assemblyManager, {
        sessionId: superArgs.sessionId,
        //@ts-ignore
        regions: superArgs.view.vview.displayedRegions,
        adapterConfig: superArgs.adapterConfig,
      })
    ).regions

    console.log({ superArgs })

    if (rpcDriverClassName === 'MainThreadRpcDriver') {
      return superArgs
    }

    const RendererType = this.pluginManager.getRendererType(
      args.rendererType,
    ) as ComparativeServerSideRendererType

    return RendererType.serializeArgsInClient(superArgs)
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
      superDeserialized as ResultsSerialized,
      args,
    )
  }
}
