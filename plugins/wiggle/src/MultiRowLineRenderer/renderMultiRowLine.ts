import {
  groupBy,
  renderToAbstractCanvas,
  updateStatus,
} from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'

import { drawLine } from '../drawLine.ts'
import { serializeWiggleFeature } from '../util.ts'

import type { MultiRenderArgsDeserialized } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

export async function renderMultiRowLine(
  renderProps: MultiRenderArgsDeserialized,
  features: Feature[],
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
  const lastCheck = createStopTokenChecker(stopToken)

  const { reducedFeatures, ...rest } = await updateStatus(
    'Rendering plot',
    statusCallback,
    () =>
      renderToAbstractCanvas(width, height, renderProps, ctx => {
        const groups = groupBy(features, f => f.get('source'))
        let feats: Feature[] = []
        ctx.save()
        for (const source of sources) {
          const { reducedFeatures } = drawLine(ctx, {
            ...renderProps,
            features: groups[source.name] || [],
            height: rowHeight,
            staticColor: source.color || 'blue',
            colorCallback: () => '', // unused when staticColor is set
            lastCheck,
          })
          ctx.strokeStyle = 'rgba(200,200,200,0.8)'
          ctx.beginPath()
          ctx.moveTo(0, rowHeight)
          ctx.lineTo(width, rowHeight)
          ctx.stroke()
          ctx.translate(0, rowHeight)
          feats = feats.concat(reducedFeatures)
        }
        ctx.restore()
        return { reducedFeatures: feats }
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
