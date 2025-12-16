import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { rpcResult } from 'librpc-web-mod'

import { drawDensityArrays } from '../drawDensity'
import { serializeReducedFeatures } from '../util'

import type { RenderArgsDeserialized } from '../types'
import type { WiggleFeatureArrays } from '../util'

export async function renderDensityArrays(
  renderProps: RenderArgsDeserialized,
  featureArrays: WiggleFeatureArrays,
) {
  const { height, regions, bpPerPx, statusCallback = () => {} } = renderProps

  const region = regions[0]!
  const width = (region.end - region.start) / bpPerPx

  const { reducedFeatures, ...rest } = await updateStatus(
    'Rendering plot',
    statusCallback,
    () =>
      renderToAbstractCanvas(width, height, renderProps, ctx =>
        drawDensityArrays(ctx, { ...renderProps, featureArrays }),
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
