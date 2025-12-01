import {
  forEachWithStopTokenCheck,
  groupBy,
  renderToAbstractCanvas,
  updateStatus,
} from '@jbrowse/core/util'

import { drawXY } from '../drawXY'

import type { MultiRenderArgsDeserialized } from '../types'
import type { Feature } from '@jbrowse/core/util'

export async function renderMultiXYPlot(
  renderProps: MultiRenderArgsDeserialized,
  features: Map<string, Feature>,
) {
  const {
    sources,
    height,
    regions,
    bpPerPx,
    stopToken,
    statusCallback = () => {},
  } = renderProps

  const region = regions[0]!
  const width = (region.end - region.start) / bpPerPx

  const { reducedFeatures, ...rest } = await updateStatus(
    'Rendering plot',
    statusCallback,
    () =>
      renderToAbstractCanvas(width, height, renderProps, ctx => {
        const groups = groupBy(features.values(), f => f.get('source'))
        let feats: Feature[] = []
        forEachWithStopTokenCheck(sources, stopToken, source => {
          const sourceFeatures = groups[source.name] || []
          const { reducedFeatures } = drawXY(ctx, {
            ...renderProps,
            features: sourceFeatures,
            colorCallback: () => source.color || 'blue',
          })
          feats = feats.concat(reducedFeatures)
        })
        return { reducedFeatures: feats }
      }),
  )

  return {
    ...rest,
    features: reducedFeatures.map(f => f.toJSON()),
    height,
    width,
  }
}
