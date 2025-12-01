import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'

import type { MultiRenderArgsDeserialized } from '../types'

export default class MultiRowLineRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: MultiRenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const { renderMultiRowLine } = await import('./renderMultiRowLine')
    return renderMultiRowLine(renderProps, features)
  }
}
