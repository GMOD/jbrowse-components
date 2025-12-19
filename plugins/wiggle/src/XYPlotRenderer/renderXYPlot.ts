import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { rpcResult } from 'librpc-web-mod'

import { drawXY } from '../drawXY'
import { getColorCallback, serializeReducedFeatures } from '../util'

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
  const colorCallback = getColorCallback(config)

  const { reducedFeatures, ...rest } = await updateStatus(
    'Rendering plot',
    statusCallback,
    () =>
      renderToAbstractCanvas(width, height, renderProps, ctx =>
        drawXY(ctx, {
          ...renderProps,
          colorCallback,
          features: [...features.values()],
        }),
      ),
  )

  const serialized = {
    ...rest,
    features: [
      ...serializeReducedFeatures(reducedFeatures, 'bigwig', region.refName),
    ],
    height,
    width,
  }

  return rpcResult(serialized, collectTransferables(rest))
}
