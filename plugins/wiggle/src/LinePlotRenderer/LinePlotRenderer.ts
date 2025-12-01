import { readConfObject } from '@jbrowse/core/configuration'
import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { rpcResult } from 'librpc-web-mod'

import { YSCALEBAR_LABEL_OFFSET } from '../util'

import type { RenderArgsDeserialized } from '../types'
import type { Feature } from '@jbrowse/core/util'

export default class LinePlotRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const { config, height, regions, bpPerPx, statusCallback = () => {} } =
      renderProps

    const region = regions[0]!
    const width = (region.end - region.start) / bpPerPx
    const c = readConfObject(config, 'color')

    const { reducedFeatures, ...rest } = await updateStatus(
      'Rendering plot',
      statusCallback,
      async () => {
        const { drawLine } = await import('../drawLine')
        return renderToAbstractCanvas(width, height, renderProps, ctx =>
          drawLine(ctx, {
            ...renderProps,
            features,
            offset: YSCALEBAR_LABEL_OFFSET,
            colorCallback:
              c === '#f0f'
                ? () => 'grey'
                : (feature: Feature) =>
                    readConfObject(config, 'color', { feature }),
          }),
        )
      },
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
