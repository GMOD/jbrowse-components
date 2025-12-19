import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'

import type { MultiRenderArgsDeserialized } from '../types'

export default class MultiRowLineRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: MultiRenderArgsDeserialized) {
    const { makeImageData } = await import('./makeImageData')
    return makeImageData(renderProps, this.pluginManager)
  }
}
