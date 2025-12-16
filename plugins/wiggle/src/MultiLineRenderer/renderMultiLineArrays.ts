import {
  forEachWithStopTokenCheck,
  renderToAbstractCanvas,
  updateStatus,
} from '@jbrowse/core/util'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { rpcResult } from 'librpc-web-mod'

import { drawLineArrays } from '../drawLine'

import type { MultiWiggleFeatureArrays } from '../MultiWiggleAdapter/MultiWiggleAdapter'
import type { MultiRenderArgsDeserialized } from '../types'
import type { ReducedFeatureArrays } from '../util'

interface SerializedFeature {
  uniqueId: string
  start: number
  end: number
  score: number
  source: string
  refName: string
}

function serializeReducedFeatures(
  reduced: ReducedFeatureArrays,
  source: string,
  refName: string,
): SerializedFeature[] {
  const { starts, ends, scores } = reduced
  const features: SerializedFeature[] = []

  for (const [i, start_] of starts.entries()) {
    const start = start_
    const end = ends[i]!
    const score = scores[i]!
    features.push({
      uniqueId: `${source}-${refName}-${start}`,
      start,
      end,
      score,
      source,
      refName,
    })
  }

  return features
}

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
        forEachWithStopTokenCheck(sources, stopToken, source => {
          const arrays = arraysBySource[source.name]
          if (arrays) {
            const { reducedFeatures } = drawLineArrays(ctx, {
              ...renderProps,
              featureArrays: arrays,
              color: source.color || 'blue',
            })
            reducedBySource[source.name] = reducedFeatures
          }
        })
        return { reducedBySource }
      }),
  )

  // Serialize reduced features for tooltip support
  const features: SerializedFeature[] = []
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
