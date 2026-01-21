import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import type VariantRendererType from '../shared/VariantRendererType.ts'

interface GetFeatureArgs {
  featureId: string
  sessionId: string
  trackInstanceId: string
  rendererType: string
}

export class MultiVariantGetFeatureDetails extends RpcMethodType {
  name = 'MultiVariantGetFeatureDetails'

  async execute(args: GetFeatureArgs) {
    const { featureId, sessionId, trackInstanceId, rendererType } = args
    const RendererType = this.pluginManager.getRendererType(
      rendererType,
    ) as unknown as VariantRendererType

    const feature = RendererType.getFeatureById(featureId, {
      sessionId,
      trackInstanceId,
    })

    return {
      feature: feature?.toJSON(),
    }
  }
}
