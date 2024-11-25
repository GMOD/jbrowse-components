import { validateRendererType } from './util'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '../../util'
import { checkStopToken } from '../../util/stopToken'
import type {
  RenderResults,
  ResultsSerialized,
  RenderArgs,
  RenderArgsSerialized,
} from './util'

/**
 * fetches features from an adapter and call a renderer with them
 */
export default class CoreRender extends RpcMethodType {
  name = 'CoreRender'

  async serializeArguments(args: RenderArgs, rpcDriver: string) {
    const { rootModel } = this.pluginManager
    const assemblyManager = rootModel!.session!.assemblyManager
    const renamedArgs = await renameRegionsIfNeeded(assemblyManager, args)

    const superArgs = (await super.serializeArguments(
      renamedArgs,
      rpcDriver,
    )) as RenderArgs
    if (rpcDriver === 'MainThreadRpcDriver') {
      return superArgs
    }

    const { rendererType } = args

    const RendererType = validateRendererType(
      rendererType,
      this.pluginManager.getRendererType(rendererType),
    )

    return RendererType.serializeArgsInClient(superArgs)
  }

  async execute(
    args: RenderArgsSerialized & { stopToken?: string },
    rpcDriver: string,
  ) {
    let deserializedArgs = args
    if (rpcDriver !== 'MainThreadRpcDriver') {
      deserializedArgs = await this.deserializeArguments(args, rpcDriver)
    }
    const { sessionId, rendererType, stopToken } = deserializedArgs
    if (!sessionId) {
      throw new Error('must pass a unique session id')
    }

    checkStopToken(stopToken)

    const RendererType = validateRendererType(
      rendererType,
      this.pluginManager.getRendererType(rendererType),
    )

    const result =
      rpcDriver === 'MainThreadRpcDriver'
        ? await RendererType.render(deserializedArgs)
        : await RendererType.renderInWorker(deserializedArgs)

    checkStopToken(stopToken)
    return result
  }

  async deserializeReturn(
    serializedReturn: RenderResults | ResultsSerialized,
    args: RenderArgs,
    rpcDriver: string,
  ): Promise<unknown> {
    const des = await super.deserializeReturn(serializedReturn, args, rpcDriver)
    if (rpcDriver === 'MainThreadRpcDriver') {
      return des
    }

    const { rendererType } = args
    const RendererType = validateRendererType(
      rendererType,
      this.pluginManager.getRendererType(rendererType),
    )
    return RendererType.deserializeResultsInClient(
      des as ResultsSerialized,
      args,
    )
  }
}
