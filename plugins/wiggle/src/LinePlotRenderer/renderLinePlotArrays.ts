import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { rpcResult } from 'librpc-web-mod'

import { drawLineArrays } from '../drawLine'
import { getStaticColor } from '../util'

import type { RenderArgsDeserialized } from '../types'
import type { WiggleFeatureArrays } from '../util'

export async function renderLinePlotArrays(
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
  const color = getStaticColor(config, 'grey')

  const { reducedFeatures, ...rest } = await updateStatus(
    'Rendering plot',
    statusCallback,
    () =>
      renderToAbstractCanvas(width, height, renderProps, ctx =>
        drawLineArrays(ctx, {
          ...renderProps,
          featureArrays,
          color,
        }),
      ),
  )

  const serialized = {
    ...rest,
    reducedFeatures,
    height,
    width,
  }

  return rpcResult(serialized, collectTransferables(rest))
}
