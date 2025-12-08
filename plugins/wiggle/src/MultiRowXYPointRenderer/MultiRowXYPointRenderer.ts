import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'

import type { MultiRenderArgsDeserialized } from '../types'

export default class MultiRowXYPointRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: MultiRenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const { renderMultiRowXYPoint } = await import('./renderMultiRowXYPoint')
    return renderMultiRowXYPoint(renderProps, features)
  }
}
