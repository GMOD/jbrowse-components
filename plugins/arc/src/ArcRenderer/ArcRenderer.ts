import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'

import type {
  RenderArgsDeserialized,
  RenderResults,
} from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'

export default class ArcRenderer extends FeatureRendererType {
  async render(renderArgs: RenderArgsDeserialized): Promise<RenderResults> {
    const features = await this.getFeatures(renderArgs)
    const result = await super.render({ ...renderArgs, features })
    return { ...result, features }
  }
}
