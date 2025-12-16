import { readConfObject } from '@jbrowse/core/configuration'
import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { rpcResult } from 'librpc-web-mod'

import { drawXYArrays } from '../drawXY'
import { serializeReducedFeatures } from '../util'

import type { RenderArgsDeserialized } from '../types'
import type { WiggleFeatureArrays } from '../util'

export async function renderXYPlotArrays(
  renderProps: RenderArgsDeserialized,
  featureArrays: WiggleFeatureArrays,
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
        drawXYArrays(ctx, {
          ...renderProps,
          featureArrays,
          posColor,
          negColor,
          pivotValue,
        }),
      ),
  )

  const features = []
  for (const f of serializeReducedFeatures(reducedFeatures, 'bigwig', region.refName)) {
    features.push(f)
  }

  const serialized = {
    ...rest,
    features,
    height,
    width,
  }

  return rpcResult(serialized, collectTransferables(rest))
}
