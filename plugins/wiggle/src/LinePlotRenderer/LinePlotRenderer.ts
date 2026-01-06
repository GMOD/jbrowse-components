import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'

import type { RenderArgsDeserialized } from '../types.ts'

export default class LinePlotRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    const { makeImageData } = await import('./makeImageData.ts')
    return makeImageData(renderProps, this.pluginManager)
  }
}
