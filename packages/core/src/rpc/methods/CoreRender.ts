import { validateRendererType } from './util.ts'
import RpcMethodType, {
  convertFileHandleLocations,
} from '../../pluggableElementTypes/RpcMethodType.ts'
import { getBlobMap } from '../../util/tracks.ts'

import type {
  RenderArgs,
  RenderArgsSerialized,
  RenderResults,
  ResultsSerialized,
} from './util.ts'
import type { StopToken } from '../../util/stopToken.ts'

export default class CoreRender extends RpcMethodType {
  name = 'CoreRender'

  async serializeArguments(args: RenderArgs, rpcDriver: string) {
    const superArgs = (await super.serializeArguments(
      await this.renameRegions(args),
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
    const renamedArgs = await this.renameRegions(args)
    const { sessionId, rendererType } = renamedArgs
    if (!sessionId) {
      throw new Error('must pass a unique session id')
    }

    // Convert FileHandleLocation to BlobLocation for consistent adapter caching.
    // Even though we're on the main thread and don't need to transfer files,
    // the adapter config hash must match what the serialized path produces.
    // getBlobMap() returns the live reference; convertFileHandleLocations
    // mutates it in place.
    const { renderingProps, ...rest } = renamedArgs
    convertFileHandleLocations(rest, getBlobMap())

    return validateRendererType(
      rendererType,
      this.pluginManager.getRendererType(rendererType),
    ).renderDirect({
      ...rest,
      renderingProps,
    })
  }

  async execute(
    args: RenderArgsSerialized & { stopToken?: StopToken },
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
