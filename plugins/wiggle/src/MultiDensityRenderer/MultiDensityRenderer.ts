import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'

import { renderMultiWiggle } from '../multiRendererHelper'

import type { MultiRenderArgsDeserialized } from '../types'

export default class MultiDensityPlotRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: MultiRenderArgsDeserialized) {
    return renderMultiWiggle(
      this.pluginManager,
      renderProps,
      async (props, arrays) => {
        const { renderMultiDensityArrays } =
          await import('./renderMultiDensityArrays')
        return renderMultiDensityArrays(props, arrays)
      },
      async (props, features) => {
        const { renderMultiDensity } = await import('./renderMultiDensity')
        return renderMultiDensity(props, features)
      },
    )
  }
}
