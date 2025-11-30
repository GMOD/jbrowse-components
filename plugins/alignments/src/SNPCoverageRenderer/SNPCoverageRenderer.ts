import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { rpcResult } from 'librpc-web-mod'

import type { RenderArgsDeserialized } from './types'

export default class SNPCoverageRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const { height, regions, bpPerPx, statusCallback = () => {} } = renderProps

    const region = regions[0]!
    const width = (region.end - region.start) / bpPerPx

    const { makeImage } = await import('./makeImage')
    const { reducedFeatures, ...rest } = await updateStatus(
      'Rendering coverage',
      statusCallback,
      () =>
        renderToAbstractCanvas(width, height, renderProps, ctx =>
          makeImage(ctx, { ...renderProps, features }),
        ),
    )

    const serialized = {
      ...rest,
      features: reducedFeatures?.map(f => f.toJSON()),
      height,
      width,
    }

    return rpcResult(serialized, collectTransferables(rest))
  }
}
