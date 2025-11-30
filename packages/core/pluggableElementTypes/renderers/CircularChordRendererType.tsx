import FeatureRenderer from './FeatureRendererType'

import type { RenderArgsDeserialized, RenderResults } from './FeatureRendererType'

export default class CircularChordRendererType extends FeatureRenderer {
  supportsSVG = true

  async render(renderArgs: RenderArgsDeserialized): Promise<RenderResults> {
    const features = await this.getFeatures(renderArgs)
    const result = await super.render({ ...renderArgs, features })
    return { ...result, features }
  }
}
