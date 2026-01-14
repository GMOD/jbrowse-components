import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'

import type { MultiRenderArgsDeserialized } from '../types.ts'

export default class MultiRowLineRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: MultiRenderArgsDeserialized) {
    const { makeImageData } = await import('./makeImageData.ts')
    return makeImageData(renderProps, this.pluginManager)
  }
}
