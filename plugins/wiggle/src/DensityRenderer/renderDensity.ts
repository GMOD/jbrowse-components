import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'

import { drawDensity } from '../drawDensity.ts'
import { serializeWiggleFeature } from '../util.ts'

import type { RenderArgsDeserialized } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

export async function renderDensity(
  renderProps: RenderArgsDeserialized,
  features: Feature[],
) {
  const { height, regions, bpPerPx, statusCallback = () => {} } = renderProps

  const region = regions[0]!
  const width = (region.end - region.start) / bpPerPx

  const reducedFeatures: Feature[] = []
  const rest = await updateStatus(
    'Rendering plot',
    statusCallback,
    () =>
      renderToAbstractCanvas(width, height, renderProps, ctx => {
        drawDensity(ctx, { ...renderProps, features, reducedFeatures })
      }),
  )

  const serialized = {
    ...rest,
    features: reducedFeatures.map(serializeWiggleFeature),
    height,
    width,
  }

  return rpcResult(serialized, collectTransferables(rest))
}
