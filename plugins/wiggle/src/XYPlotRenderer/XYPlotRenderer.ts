import { readConfObject } from '@jbrowse/core/configuration'
import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { rpcResult } from 'librpc-web-mod'

import { YSCALEBAR_LABEL_OFFSET } from '../util'

import type { RenderArgsDeserialized } from '../types'

export default class XYPlotRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const {
      config,
      inverted,
      height,
      regions,
      bpPerPx,
      stopToken,
      statusCallback = () => {},
    } = renderProps

    const region = regions[0]!
    const width = (region.end - region.start) / bpPerPx

    const pivotValue = readConfObject(config, 'bicolorPivotValue')
    const negColor = readConfObject(config, 'negColor')
    const posColor = readConfObject(config, 'posColor')

    const { reducedFeatures, ...rest } = await updateStatus(
      'Rendering plot',
      statusCallback,
      async () => {
        const { drawXY } = await import('../drawXY')
        return renderToAbstractCanvas(width, height, renderProps, ctx =>
          drawXY(ctx, {
            ...renderProps,
            colorCallback: !config.color.isCallback
              ? (_feature, score) => (score < pivotValue ? negColor : posColor)
              : (feature, _score) =>
                  readConfObject(config, 'color', { feature }),
            offset: YSCALEBAR_LABEL_OFFSET,
            features: [...features.values()],
            inverted,
            stopToken,
          }),
        )
      },
    )

    const serialized = {
      ...rest,
      features: reducedFeatures.map(f => f.toJSON()),
      height,
      width,
    }

    return rpcResult(serialized, collectTransferables(rest))
  }
}
