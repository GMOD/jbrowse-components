import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'

import type { MultiRenderArgsDeserialized } from '../types'

export default class MultiXYPlotRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: MultiRenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const { renderMultiXYPlot } = await import('./renderMultiXYPlot')
    return renderMultiXYPlot(renderProps, features)
  }
}
