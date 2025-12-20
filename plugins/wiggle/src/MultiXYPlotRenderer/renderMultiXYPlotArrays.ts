import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { checkStopToken2 } from '@jbrowse/core/util/stopToken'
import { rpcResult } from 'librpc-web-mod'

import { drawXYArrays } from '../drawXY'

import type { MultiWiggleFeatureArrays } from '../MultiWiggleAdapter/MultiWiggleAdapter'
import type { MultiRenderArgsDeserialized } from '../types'
import type { ReducedFeatureArrays } from '../util'

export async function renderMultiXYPlotArrays(
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

  const { reducedFeatures, ...rest } = await updateStatus(
    'Rendering plot',
    statusCallback,
    () =>
      renderToAbstractCanvas(width, height, renderProps, ctx => {
        const reducedFeatures: Record<string, ReducedFeatureArrays> = {}
        const lastCheck = { time: Date.now() }
        let idx = 0
        for (const source of sources) {
          const arrays = arraysBySource[source.name]
          if (arrays) {
            const { reducedFeatures: reduced } = drawXYArrays(ctx, {
              ...renderProps,
              featureArrays: arrays,
              color: source.color || 'blue',
            })
            reducedFeatures[source.name] = reduced
          }
          checkStopToken2(stopToken, idx++, lastCheck)
        }
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
