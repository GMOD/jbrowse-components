import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'

import { renderMultiWiggle } from '../multiRendererHelper'

import type { MultiRenderArgsDeserialized } from '../types'

export default class MultiLineRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: MultiRenderArgsDeserialized) {
    return renderMultiWiggle(
      this.pluginManager,
      renderProps,
      () => this.getFeatures(renderProps),
      async (props, arrays) => {
        const { renderMultiLineArrays } = await import('./renderMultiLineArrays')
        return renderMultiLineArrays(props, arrays)
      },
      async (props, features) => {
        const { renderMultiLine } = await import('./renderMultiLine')
        return renderMultiLine(props, features)
      },
    )
  }
}
