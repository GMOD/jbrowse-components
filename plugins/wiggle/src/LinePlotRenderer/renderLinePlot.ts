import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'

import { drawLine } from '../drawLine.ts'
import { getColorCallback, serializeWiggleFeature } from '../util.ts'

import type { RenderArgsDeserialized } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

export async function renderLinePlot(
  renderProps: RenderArgsDeserialized,
  features: Feature[],
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
  const colorCallback = getColorCallback(config, { defaultColor: 'grey' })

  const reducedFeatures: Feature[] = []
  const rest = await updateStatus(
    'Rendering plot',
    statusCallback,
    () =>
      renderToAbstractCanvas(width, height, renderProps, ctx => {
        drawLine(ctx, {
          ...renderProps,
          features,
          colorCallback,
          reducedFeatures,
        })
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
