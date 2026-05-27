import { validateRendererType } from './util.ts'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType.ts'

import type { RenderArgs, RenderArgsSerialized } from './util.ts'
import type { BoxRendererType } from '../../pluggableElementTypes/index.ts'
import type { Feature } from '../../util/simpleFeature.ts'
import type { StopToken } from '../../util/stopToken.ts'

/**
 * fetches feature details from the layout cache (uses WeakRef)
 */
export default class CoreGetFeatureDetails extends RpcMethodType {
  name = 'CoreGetFeatureDetails'

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

  async execute(
    args: RenderArgsSerialized & { stopToken?: StopToken; featureId: string },
    rpcDriver: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(args, rpcDriver)
    const { rendererType, featureId } = deserializedArgs
    const RendererType = this.pluginManager.getRendererType(
      rendererType,
    )! as BoxRendererType
    const data = RendererType.getLayoutSession(args)?.cachedLayout?.layout.getDataByID(
      featureId,
    ) as Feature | undefined
    return { feature: data?.toJSON() }
  }
}
