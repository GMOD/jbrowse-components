import { readConfObject } from '@jbrowse/core/configuration'
import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { rpcResult } from 'librpc-web-mod'

import { drawXY } from '../drawXY'

import type { RenderArgsDeserialized } from '../types'
import type { Feature } from '@jbrowse/core/util'

export async function renderXYPlot(
  renderProps: RenderArgsDeserialized,
  features: Map<string, Feature>,
) {
  const {
    config,
    height,
    regions,
    bpPerPx,
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
          features: [...features.values()],
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
