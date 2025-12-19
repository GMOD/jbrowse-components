import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'

import type { RenderArgsDeserialized } from '../types'

export default class DensityRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    const { makeImageData } = await import('./makeImageData')
    return makeImageData(renderProps, this.pluginManager)
  }
}
