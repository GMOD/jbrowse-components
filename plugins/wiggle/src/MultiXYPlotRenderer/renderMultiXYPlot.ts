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
        let allReducedFeatures: Feature[] = []
        const lastCheck = { time: Date.now() }
        let idx = 0
        for (const source of sources) {
          const { reducedFeatures: reduced } = drawXY(ctx, {
            ...renderProps,
            features: groups[source.name] || [],
            colorCallback: () => source.color || 'blue',
          })
          allReducedFeatures = allReducedFeatures.concat(reduced)
          checkStopToken2(stopToken, idx++, lastCheck)
        }
        return { reducedFeatures: allReducedFeatures }
      }),
  )

  const serialized = {
    ...rest,
    reducedFeatures: reducedFeatures.map(serializeWiggleFeature),
    height,
    width,
  }

  return rpcResult(serialized, collectTransferables(rest))
}
