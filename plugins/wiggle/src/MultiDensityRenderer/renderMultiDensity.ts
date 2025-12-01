import {
  forEachWithStopTokenCheck,
  groupBy,
  renderToAbstractCanvas,
  updateStatus,
} from '@jbrowse/core/util'

import { drawDensity } from '../drawDensity'

import type { MultiRenderArgsDeserialized } from '../types'
import type { Feature } from '@jbrowse/core/util'

export async function renderMultiDensity(
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
  const rowHeight = height / sources.length

  const { reducedFeatures, ...rest } = await updateStatus(
    'Rendering plot',
    statusCallback,
    () =>
      renderToAbstractCanvas(width, height, renderProps, ctx => {
        const groups = groupBy(features.values(), f => f.get('source'))
        let feats: Feature[] = []
        ctx.save()
        forEachWithStopTokenCheck(sources, stopToken, source => {
          const sourceFeatures = groups[source.name] || []
          const { reducedFeatures } = drawDensity(ctx, {
            ...renderProps,
            features: new Map(sourceFeatures.map(f => [f.id(), f])),
            height: rowHeight,
          })
          ctx.translate(0, rowHeight)
          feats = feats.concat(reducedFeatures)
        })
        ctx.restore()
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
