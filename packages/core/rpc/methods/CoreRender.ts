import { validateRendererType } from './util'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '../../util'

import type {
  RenderArgs,
  RenderArgsSerialized,
  RenderResults,
  ResultsSerialized,
} from './util'

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

    return validateRendererType(
      args.rendererType,
      this.pluginManager.getRendererType(args.rendererType),
    ).serializeArgsInClient(superArgs)
  }

  /**
   * Execute directly without serialization. Used by MainThreadRpcDriver
   * to bypass the serialize/deserialize overhead.
   */
  async executeDirect(args: RenderArgs) {
    const { rootModel } = this.pluginManager
    const assemblyManager = rootModel!.session!.assemblyManager
    const renamedArgs = await renameRegionsIfNeeded(assemblyManager, args)
    const { sessionId, rendererType } = renamedArgs
    if (!sessionId) {
      throw new Error('must pass a unique session id')
    }

    return validateRendererType(
      rendererType,
      this.pluginManager.getRendererType(rendererType),
    ).renderDirect(renamedArgs)
  }

  async execute(
    args: RenderArgsSerialized & { stopToken?: string },
    rpcDriver: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(args, rpcDriver)
    const { sessionId, rendererType } = deserializedArgs
    if (!sessionId) {
      throw new Error('must pass a unique session id')
    }

    return validateRendererType(
      rendererType,
      this.pluginManager.getRendererType(rendererType),
    ).renderInWorker(deserializedArgs)
  }

  async deserializeReturn(
    serializedReturn: RenderResults | ResultsSerialized,
    args: RenderArgs,
    rpcDriver: string,
  ): Promise<unknown> {
    const des = await super.deserializeReturn(serializedReturn, args, rpcDriver)
    // always call deserializeResultsInClient to ensure renderingProps are
    // properly spread into the React component props
    return validateRendererType(
      args.rendererType,
      this.pluginManager.getRendererType(args.rendererType),
    ).deserializeResultsInClient(des as ResultsSerialized, args)
  }
}
