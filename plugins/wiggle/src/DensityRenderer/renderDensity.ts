import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { rpcResult } from 'librpc-web-mod'

import { drawDensity } from '../drawDensity'

import type { RenderArgsDeserialized } from '../types'
import type { Feature } from '@jbrowse/core/util'

export async function renderDensity(
  renderProps: RenderArgsDeserialized,
  features: Map<string, Feature>,
) {
  const { height, regions, bpPerPx, statusCallback = () => {} } = renderProps

  const region = regions[0]!
  const width = (region.end - region.start) / bpPerPx

  const { reducedFeatures, ...rest } = await updateStatus(
    'Rendering plot',
    statusCallback,
    () =>
      renderToAbstractCanvas(width, height, renderProps, ctx =>
        drawDensity(ctx, { ...renderProps, features }),
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
