import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import { renderToAbstractCanvas } from '@jbrowse/core/util'

import type { MultiRenderArgsDeserialized } from './types'
import type { Feature } from '@jbrowse/core/util'

export default class MultiVariantBaseRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: MultiRenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const { height, referenceDrawingMode, regions, bpPerPx } = renderProps
    const region = regions[0]!
    const width = (region.end - region.start) / bpPerPx

    const { makeImageData } = await import('./makeImageData')

    const ret = await renderToAbstractCanvas(
      width,
      height,
      renderProps,
      ctx => {
        if (referenceDrawingMode === 'skip') {
          ctx.fillStyle = '#ccc'
          ctx.fillRect(0, 0, width, height)
        }
        return makeImageData(ctx, {
          ...renderProps,
          features,
        })
      },
    )

    const results = await super.render({
      ...renderProps,
      ...ret,
      features,
      height,
      width,
    })

    return {
      ...results,
      ...ret,
      features: new Map<string, Feature>(),
      height,
      width,
      containsNoTransferables: true,
    }
  }
}
