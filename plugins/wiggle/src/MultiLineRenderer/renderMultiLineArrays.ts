import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { checkStopToken2 } from '@jbrowse/core/util/stopToken'
import { rpcResult } from 'librpc-web-mod'

import { drawLineArrays } from '../drawLine'
import { serializeReducedFeatures } from '../util'

import type { MultiWiggleFeatureArrays } from '../MultiWiggleAdapter/MultiWiggleAdapter'
import type { MultiRenderArgsDeserialized } from '../types'
import type { ReducedFeatureArrays } from '../util'

export async function renderMultiLineArrays(
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

  const { reducedBySource, ...rest } = await updateStatus(
    'Rendering plot',
    statusCallback,
    () =>
      renderToAbstractCanvas(width, height, renderProps, ctx => {
        const reducedBySource: Record<string, ReducedFeatureArrays> = {}
        const lastCheck = { time: Date.now() }
        let idx = 0
        for (const source of sources) {
          const arrays = arraysBySource[source.name]
          if (arrays) {
            const { reducedFeatures } = drawLineArrays(ctx, {
              ...renderProps,
              featureArrays: arrays,
              color: source.color || 'blue',
            })
            reducedBySource[source.name] = reducedFeatures
          }
          checkStopToken2(stopToken, idx++, lastCheck)
        }
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
