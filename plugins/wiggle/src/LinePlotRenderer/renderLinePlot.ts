import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { rpcResult } from 'librpc-web-mod'

import { drawLine } from '../drawLine'
import { getColorCallback, serializeWiggleFeature } from '../util'

import type { RenderArgsDeserialized } from '../types'
import type { Feature } from '@jbrowse/core/util'

export async function renderLinePlot(
  renderProps: RenderArgsDeserialized,
  features: Map<string, Feature>,
) {
  const { config, height, regions, bpPerPx, statusCallback = () => {} } =
    renderProps

  const region = regions[0]!
  const width = (region.end - region.start) / bpPerPx
  const colorCallback = getColorCallback(config, { defaultColor: 'grey' })

  const { reducedFeatures, ...rest } = await updateStatus(
    'Rendering plot',
    statusCallback,
    () =>
      renderToAbstractCanvas(width, height, renderProps, ctx =>
        drawLine(ctx, {
          ...renderProps,
          features,
          colorCallback,
        }),
      ),
  )

  const serialized = {
    ...rest,
    features: reducedFeatures.map(serializeWiggleFeature),
    height,
    width,
  }

  return rpcResult(serialized, collectTransferables(rest))
}
