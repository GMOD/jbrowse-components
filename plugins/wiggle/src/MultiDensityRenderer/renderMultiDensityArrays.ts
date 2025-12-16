import {
  forEachWithStopTokenCheck,
  renderToAbstractCanvas,
  updateStatus,
} from '@jbrowse/core/util'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { rpcResult } from 'librpc-web-mod'

import { drawDensityArrays } from '../drawDensity'
import { serializeReducedFeatures } from '../util'

import type { MultiWiggleFeatureArrays } from '../MultiWiggleAdapter/MultiWiggleAdapter'
import type { MultiRenderArgsDeserialized } from '../types'
import type { ReducedFeatureArrays } from '../util'

export async function renderMultiDensityArrays(
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
            const { reducedFeatures } = drawDensityArrays(ctx, {
              ...renderProps,
              featureArrays: arrays,
              height: rowHeight,
            })
            reducedBySource[source.name] = reducedFeatures
          }
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
      features.push(
        ...serializeReducedFeatures(reduced, source.name, region.refName),
      )
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
