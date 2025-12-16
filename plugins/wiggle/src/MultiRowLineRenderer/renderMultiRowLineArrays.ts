import {
  forEachWithStopTokenCheck,
  renderToAbstractCanvas,
  updateStatus,
} from '@jbrowse/core/util'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { rpcResult } from 'librpc-web-mod'

import { drawLineArrays } from '../drawLine'
import { serializeReducedFeatures } from '../util'

import type { MultiWiggleFeatureArrays } from '../MultiWiggleAdapter/MultiWiggleAdapter'
import type { MultiRenderArgsDeserialized } from '../types'
import type { ReducedFeatureArrays } from '../util'

export async function renderMultiRowLineArrays(
  renderProps: MultiRenderArgsDeserialized,
  arraysBySource: MultiWiggleFeatureArrays,
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

  const { reducedBySource, ...rest } = await updateStatus(
    'Rendering plot',
    statusCallback,
    () =>
      renderToAbstractCanvas(width, height, renderProps, ctx => {
        const reducedBySource: Record<string, ReducedFeatureArrays> = {}
        ctx.save()
        forEachWithStopTokenCheck(sources, stopToken, source => {
          const arrays = arraysBySource[source.name]
          if (arrays) {
            const { reducedFeatures } = drawLineArrays(ctx, {
              ...renderProps,
              featureArrays: arrays,
              height: rowHeight,
              color: source.color || 'blue',
            })
            reducedBySource[source.name] = reducedFeatures
          }
          ctx.strokeStyle = 'rgba(200,200,200,0.8)'
          ctx.beginPath()
          ctx.moveTo(0, rowHeight)
          ctx.lineTo(width, rowHeight)
          ctx.stroke()
          ctx.translate(0, rowHeight)
        })
        ctx.restore()
        return { reducedBySource }
      }),
  )

  // Serialize reduced features for tooltip support
  const features = []
  for (const source of sources) {
    const reduced = reducedBySource[source.name]
    if (reduced) {
      for (const f of serializeReducedFeatures(
        reduced,
        source.name,
        region.refName,
      )) {
        features.push(f)
      }
    }
  }

  const serialized = {
    ...rest,
    features,
    height,
    width,
  }

  return rpcResult(serialized, collectTransferables(rest))
}
