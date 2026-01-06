import RpcMethodType from '../../pluggableElementTypes/RpcMethodType.ts'
import { renameRegionsIfNeeded } from '../../util/index.ts'

import type { RenderArgs, RenderArgsSerialized } from './util.ts'
import type { BoxRendererType } from '../../pluggableElementTypes/index.ts'

/**
 * fetches feature details from the layout cache (uses WeakRef)
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
      feature: RendererType.getLayoutSession(args)
        // @ts-expect-error
        ?.cachedLayout.layout.getDataByID(featureId)
        ?.toJSON(),
    }
  }
}
