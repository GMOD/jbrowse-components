import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'

import { renderMultiWiggle } from '../multiRendererHelper'

import type { MultiRenderArgsDeserialized } from '../types'

export default class MultiRowLineRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: MultiRenderArgsDeserialized) {
    return renderMultiWiggle(
      this.pluginManager,
      renderProps,
      async (props, arrays) => {
        const { renderMultiRowLineArrays } =
          await import('./renderMultiRowLineArrays')
        return renderMultiRowLineArrays(props, arrays)
      },
      async (props, features) => {
        const { renderMultiRowLine } = await import('./renderMultiRowLine')
        return renderMultiRowLine(props, features)
      },
    )
  }
}
