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
    if (rpcDriver === 'MainThreadRpcDriver') {
      return superArgs
    }

    return validateRendererType(
      args.rendererType,
      this.pluginManager.getRendererType(args.rendererType),
    ).serializeArgsInClient(superArgs)
  }

  async execute(
    args: RenderArgsSerialized & { stopToken?: string },
    rpcDriver: string,
  ) {
    let deserializedArgs = args
    if (rpcDriver !== 'MainThreadRpcDriver') {
      deserializedArgs = await this.deserializeArguments(args, rpcDriver)
    }
    const { sessionId, rendererType } = deserializedArgs
    if (!sessionId) {
      throw new Error('must pass a unique session id')
    }

    const RendererType = validateRendererType(
      rendererType,
      this.pluginManager.getRendererType(rendererType),
    )

    return rpcDriver === 'MainThreadRpcDriver'
      ? await RendererType.render(deserializedArgs)
      : await RendererType.renderInWorker(deserializedArgs)
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
    return validateRendererType(
      args.rendererType,
      this.pluginManager.getRendererType(args.rendererType),
    ).deserializeResultsInClient(des as ResultsSerialized, args)
  }
}
