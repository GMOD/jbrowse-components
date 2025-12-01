import { readConfObject } from '@jbrowse/core/configuration'
import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { rpcResult } from 'librpc-web-mod'

import { drawXY } from '../drawXY'
import { YSCALEBAR_LABEL_OFFSET } from '../util'

import type { RenderArgsDeserialized } from '../types'
import type { Feature } from '@jbrowse/core/util'

export async function renderXYPlot(
  renderProps: RenderArgsDeserialized,
  features: Map<string, Feature>,
) {
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
    () =>
      renderToAbstractCanvas(width, height, renderProps, ctx =>
        drawXY(ctx, {
          ...renderProps,
          colorCallback: !config.color.isCallback
            ? (_feature, score) => (score < pivotValue ? negColor : posColor)
            : (feature, _score) => readConfObject(config, 'color', { feature }),
          offset: YSCALEBAR_LABEL_OFFSET,
          features: [...features.values()],
          inverted,
          stopToken,
        }),
      ),
  )

  const serialized = {
    ...rest,
    features: reducedFeatures.map(f => f.toJSON()),
    height,
    width,
  }

  return rpcResult(serialized, collectTransferables(rest))
}
