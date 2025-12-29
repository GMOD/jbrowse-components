import {
  groupBy,
  renderToAbstractCanvas,
  updateStatus,
} from '@jbrowse/core/util'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'
import { rpcResult } from 'librpc-web-mod'

import { drawDensity } from '../drawDensity'
import { serializeWiggleFeature } from '../util'

import type { MultiRenderArgsDeserialized } from '../types'
import type { Feature } from '@jbrowse/core/util'

export async function renderMultiDensity(
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
          const { reducedFeatures } = drawDensity(ctx, {
            ...renderProps,
            features: groups[source.name] || [],
            height: rowHeight,
            lastCheck,
          })
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
