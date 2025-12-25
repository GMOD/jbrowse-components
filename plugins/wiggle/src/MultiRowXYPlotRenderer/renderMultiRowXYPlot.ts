import {
  groupBy,
  renderToAbstractCanvas,
  updateStatus,
} from '@jbrowse/core/util'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { checkStopToken2 } from '@jbrowse/core/util/stopToken'
import { rpcResult } from 'librpc-web-mod'

import { drawXY } from '../drawXY'
import { serializeWiggleFeature } from '../util'

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
        let allReducedFeatures: Feature[] = []
        ctx.save()
        const lastCheck = { time: Date.now() }
        let idx = 0
        for (const source of sources) {
          const { reducedFeatures: reduced } = drawXY(ctx, {
            ...renderProps,
            features: groups[source.name] || [],
            height: rowHeight,
            colorCallback: () => source.color || 'blue',
          })
          allReducedFeatures = allReducedFeatures.concat(reduced)
          ctx.strokeStyle = 'rgba(200,200,200,0.8)'
          ctx.beginPath()
          ctx.moveTo(0, rowHeight)
          ctx.lineTo(width, rowHeight)
          ctx.stroke()
          ctx.translate(0, rowHeight)
          checkStopToken2(stopToken, idx++, lastCheck)
        }
        ctx.restore()
        return { reducedFeatures: allReducedFeatures }
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
