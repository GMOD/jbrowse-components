import {
  groupBy,
  renderToAbstractCanvas,
  updateStatus,
} from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'

import { drawLine } from '../drawLine'
import { serializeWiggleFeature } from '../util'

import type { MultiRenderArgsDeserialized } from '../types'
import type { Feature } from '@jbrowse/core/util'

export async function renderMultiLine(
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
        let feats: Feature[] = []
        for (const source of sources) {
          const { reducedFeatures } = drawLine(ctx, {
            ...renderProps,
            features: groups[source.name] || [],
            staticColor: source.color || 'blue',
            colorCallback: () => '', // unused when staticColor is set
            lastCheck,
          })
          feats = feats.concat(reducedFeatures)
        }
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
