import { readConfObject } from '@jbrowse/core/configuration'
import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'

import { drawLine } from '../drawLine'

import type { RenderArgsDeserialized } from '../types'
import type { Feature } from '@jbrowse/core/util'

export async function renderLinePlot(
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
  const c = readConfObject(config, 'color')

  const { reducedFeatures, ...rest } = await updateStatus(
    'Rendering plot',
    statusCallback,
    () =>
      renderToAbstractCanvas(width, height, renderProps, ctx =>
        drawLine(ctx, {
          ...renderProps,
          features,
          colorCallback:
            c === '#f0f'
              ? () => 'grey'
              : (feature: Feature) =>
                  readConfObject(config, 'color', { feature }),
        }),
      ),
  )

  return {
    ...rest,
    features: reducedFeatures.map(f => f.toJSON()),
    height,
    width,
  }
}
