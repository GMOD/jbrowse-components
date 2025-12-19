import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'

import { renderMultiWiggle } from '../multiRendererHelper'

import type { MultiRenderArgsDeserialized } from '../types'

export default class MultiRowXYPlotRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: MultiRenderArgsDeserialized) {
    return renderMultiWiggle(
      this.pluginManager,
      renderProps,
      () => this.getFeatures(renderProps),
      async (props, arrays) => {
        const { renderMultiRowXYPlotArrays } = await import('./renderMultiRowXYPlotArrays')
        return renderMultiRowXYPlotArrays(props, arrays)
      },
      async (props, features) => {
        const { renderMultiRowXYPlot } = await import('./renderMultiRowXYPlot')
        return renderMultiRowXYPlot(props, features)
      },
    )
  }
}
