import { renderToAbstractCanvas } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'

import VariantRendererType from '../shared/VariantRendererType.ts'

import type { RenderArgsDeserialized } from './types.ts'

export default class LinearVariantMatrixRenderer extends VariantRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const {
      height,
      regions,
      bpPerPx,
      scrollTop,
      rowHeight,
      sessionId,
      trackInstanceId,
    } = renderProps
    const region = regions[0]!
    const width = (region.end - region.start) / bpPerPx

    this.cacheFeatures({ sessionId, trackInstanceId }, region.refName, features)

    const { makeImageData } = await import('./makeImageData.ts')
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

    const simplifiedFeatures = mafs.map(({ feature }) => ({
      uniqueId: feature.id(),
      start: feature.get('start'),
      end: feature.get('end'),
      refName: feature.get('refName'),
    }))

    // Don't serialize features - they're stored in the cache and fetched via RPC
    const serialized = {
      ...rest,
      simplifiedFeatures,
      height,
      width,
      origScrollTop: scrollTop,
      rowHeight,
    }

    return rpcResult(serialized, collectTransferables(rest))
  }
}
