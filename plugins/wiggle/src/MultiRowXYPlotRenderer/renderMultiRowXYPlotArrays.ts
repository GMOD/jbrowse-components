import {
  forEachWithStopTokenCheck,
  renderToAbstractCanvas,
  updateStatus,
} from '@jbrowse/core/util'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { rpcResult } from 'librpc-web-mod'

import { drawXYArrays } from '../drawXY'

import type { MultiWiggleFeatureArrays } from '../MultiWiggleAdapter/MultiWiggleAdapter'
import type { MultiRenderArgsDeserialized } from '../types'

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

  const rest = await updateStatus('Rendering plot', statusCallback, () =>
    renderToAbstractCanvas(width, height, renderProps, ctx => {
      ctx.save()
      forEachWithStopTokenCheck(sources, stopToken, source => {
        const arrays = arraysBySource[source.name]
        if (arrays) {
          drawXYArrays(ctx, {
            ...renderProps,
            featureArrays: arrays,
            height: rowHeight,
            color: source.color || 'blue',
          })
        }
        ctx.strokeStyle = 'rgba(200,200,200,0.8)'
        ctx.beginPath()
        ctx.moveTo(0, rowHeight)
        ctx.lineTo(width, rowHeight)
        ctx.stroke()
        ctx.translate(0, rowHeight)
      })
      ctx.restore()
      return {}
    }),
  )

  const serialized = {
    ...rest,
    features: [],
    height,
    width,
  }

  return rpcResult(serialized, collectTransferables(rest))
}
