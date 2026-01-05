import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import { renderToAbstractCanvas } from '@jbrowse/core/util'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { rpcResult } from '@jbrowse/core/util/librpc'

import type { RenderArgsDeserialized } from './types'

export default class LinearVariantMatrixRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const { height, regions, bpPerPx, scrollTop, rowHeight } = renderProps
    const region = regions[0]!
    const width = (region.end - region.start) / bpPerPx

    const { makeImageData } = await import('./makeImageData')
    const { mafs, ...rest } = await renderToAbstractCanvas(
      width,
      height,
      renderProps,
      ctx =>
        makeImageData({
          ctx,
          canvasWidth: width,
          canvasHeight: height,
          renderArgs: { ...renderProps, features },
        }),
    )

    const serialized = {
      ...rest,
      simplifiedFeatures: mafs.map(({ feature }) => ({
        uniqueId: feature.id(),
        start: feature.get('start'),
        end: feature.get('end'),
        refName: feature.get('refName'),
      })),
      height,
      width,
      origScrollTop: scrollTop,
      rowHeight,
    }

    return rpcResult(serialized, collectTransferables(rest))
  }
}
