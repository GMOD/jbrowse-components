import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'

import type { RenderArgsDeserialized } from '../types'

export default class LinePlotRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const { renderLinePlot } = await import('./renderLinePlot')
    return renderLinePlot(renderProps, features)
  }
}
