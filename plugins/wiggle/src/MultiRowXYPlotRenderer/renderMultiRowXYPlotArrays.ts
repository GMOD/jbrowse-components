import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { checkStopToken2 } from '@jbrowse/core/util/stopToken'
import { rpcResult } from 'librpc-web-mod'

import { drawXYArrays } from '../drawXY'

import type { MultiWiggleFeatureArrays } from '../MultiWiggleAdapter/MultiWiggleAdapter'
import type { MultiRenderArgsDeserialized } from '../types'
import type { ReducedFeatureArrays } from '../util'

export async function renderMultiRowXYPlotArrays(
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

  const { reducedFeatures, ...rest } = await updateStatus(
    'Rendering plot',
    statusCallback,
    () =>
      renderToAbstractCanvas(width, height, renderProps, ctx => {
        const reducedFeatures: Record<string, ReducedFeatureArrays> = {}
        ctx.save()
        const lastCheck = { time: Date.now() }
        let idx = 0
        for (const source of sources) {
          const arrays = arraysBySource[source.name]
          if (arrays) {
            const { reducedFeatures: reduced } = drawXYArrays(ctx, {
              ...renderProps,
              featureArrays: arrays,
              height: rowHeight,
              color: source.color || 'blue',
            })
            reducedFeatures[source.name] = reduced
          }
          ctx.strokeStyle = 'rgba(200,200,200,0.8)'
          ctx.beginPath()
          ctx.moveTo(0, rowHeight)
          ctx.lineTo(width, rowHeight)
          ctx.stroke()
          ctx.translate(0, rowHeight)
          checkStopToken2(stopToken, idx++, lastCheck)
        }
        ctx.restore()
        return { reducedFeatures }
      }),
  )

  const serialized = {
    ...rest,
    reducedFeatures,
    height,
    width,
  }

  return rpcResult(serialized, collectTransferables(rest))
}
