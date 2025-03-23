import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import { renderToAbstractCanvas } from '@jbrowse/core/util'

import type { MultiRenderArgsDeserialized } from './types'
import type { Feature } from '@jbrowse/core/util'

export default class MultiVariantBaseRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: MultiRenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const { height, regions, bpPerPx } = renderProps
    const region = regions[0]!
    const width = (region.end - region.start) / bpPerPx

    const { makeImageData } = await import('./makeImageData')

    const rest = await renderToAbstractCanvas(width, height, renderProps, ctx =>
      makeImageData(ctx, {
        ...renderProps,
        features,
      }),
    )

    const results = await super.render({
      ...renderProps,
      ...rest,
      features,
      height,
      width,
    })

    return {
      ...results,
      ...rest,
      features: new Map<string, Feature>(),
      height,
      width,
      containsNoTransferables: true,
    }
  }
}
