import RpcMethodType from '../../pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '../../util'

import type { RenderArgs, RenderArgsSerialized } from './util'
import type { BoxRendererType } from '../../pluggableElementTypes'

/**
 * fetches features from an adapter and call a renderer with them
 */
export default class CoreGetFeatureDetails extends RpcMethodType {
  name = 'CoreGetFeatureDetails'

  async serializeArguments(args: RenderArgs, rpcDriver: string) {
    const { rootModel } = this.pluginManager
    const assemblyManager = rootModel!.session!.assemblyManager
    const renamedArgs = await renameRegionsIfNeeded(assemblyManager, args)
    const superArgs = (await super.serializeArguments(
      renamedArgs,
      rpcDriver,
    )) as RenderArgs
    const { rendererType } = args
    const RendererType = this.pluginManager.getRendererType(rendererType)!
    // @ts-expect-error
    return RendererType.serializeArgsInClient(superArgs)
  }

  async execute(
    args: RenderArgsSerialized & { stopToken?: string },
    rpcDriver: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(args, rpcDriver)
    const { rendererType, featureId } = deserializedArgs
    const RendererType = this.pluginManager.getRendererType(
      rendererType,
    )! as BoxRendererType

    return {
      // @ts-expect-error
      feature: RendererType.getLayoutSession(args)
        // @ts-expect-error
        ?.cachedLayout.layout.getDataByID(featureId)
        // @ts-expect-error
        ?.toJSON(),
    }
  }
}
