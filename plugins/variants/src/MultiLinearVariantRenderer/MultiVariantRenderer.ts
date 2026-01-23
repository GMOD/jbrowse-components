import { renderToAbstractCanvas } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'

import VariantRendererType from '../shared/VariantRendererType.ts'

import type { MultiRenderArgsDeserialized } from './types.ts'

export default class MultiVariantRenderer extends VariantRendererType {
  supportsSVG = true

  async render(renderProps: MultiRenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const {
      height,
      referenceDrawingMode,
      regions,
      bpPerPx,
      scrollTop,
      sessionId,
      trackInstanceId,
    } = renderProps
    const region = regions[0]!
    const width = (region.end - region.start) / bpPerPx

    this.cacheFeatures({ sessionId, trackInstanceId }, region.refName, features)

    const { makeImageData } = await import('./makeImageData.ts')

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

    // Don't serialize features - they're stored in the cache and fetched via RPC
    const serialized = {
      ...ret,
      height,
      width,
      origScrollTop: scrollTop,
    }

    return rpcResult(serialized, collectTransferables(ret))
  }
}
