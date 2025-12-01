import { readConfObject } from '@jbrowse/core/configuration'
import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { rpcResult } from 'librpc-web-mod'

import { drawLine } from '../drawLine'
import { YSCALEBAR_LABEL_OFFSET } from '../util'

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
  const c = readConfObject(config, 'color')

  const { reducedFeatures, ...rest } = await updateStatus(
    'Rendering plot',
    statusCallback,
    () =>
      renderToAbstractCanvas(width, height, renderProps, ctx =>
        drawLine(ctx, {
          ...renderProps,
          features,
          offset: YSCALEBAR_LABEL_OFFSET,
          colorCallback:
            c === '#f0f'
              ? () => 'grey'
              : (feature: Feature) =>
                  readConfObject(config, 'color', { feature }),
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
