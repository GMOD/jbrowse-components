import {
  forEachWithStopTokenCheck,
  groupBy,
  renderToAbstractCanvas,
  updateStatus,
} from '@jbrowse/core/util'

import { drawXY } from '../drawXY'

import type { MultiRenderArgsDeserialized } from '../types'
import type { Feature } from '@jbrowse/core/util'

export async function renderMultiRowXYPlot(
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
          const { reducedFeatures } = drawXY(ctx, {
            ...renderProps,
            features: sourceFeatures,
            height: rowHeight,
            colorCallback: () => source.color || 'blue',
          })
          ctx.strokeStyle = 'rgba(200,200,200,0.8)'
          ctx.beginPath()
          ctx.moveTo(0, rowHeight)
          ctx.lineTo(width, rowHeight)
          ctx.stroke()
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
