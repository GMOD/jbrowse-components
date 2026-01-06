import {
  groupBy,
  renderToAbstractCanvas,
  updateStatus,
} from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'

import { drawXY } from '../drawXY.ts'
import { serializeWiggleFeature } from '../util.ts'

import type { MultiRenderArgsDeserialized } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

export async function renderMultiXYPlot(
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

  const lastCheck = createStopTokenChecker(stopToken)
  const { reducedFeatures, ...rest } = await updateStatus(
    'Rendering plot',
    statusCallback,
    () =>
      renderToAbstractCanvas(width, height, renderProps, ctx => {
        const groups = groupBy(features, f => f.get('source'))
        let allReducedFeatures: Feature[] = []
        for (const source of sources) {
          const { reducedFeatures: reduced } = drawXY(ctx, {
            ...renderProps,
            features: groups[source.name] || [],
            colorCallback: () => source.color || 'blue',
            lastCheck,
          })
          allReducedFeatures = allReducedFeatures.concat(reduced)
        }
        return {
          reducedFeatures: allReducedFeatures,
        }
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
