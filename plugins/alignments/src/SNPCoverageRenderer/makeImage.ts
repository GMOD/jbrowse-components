import { renderToAbstractCanvas } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { rpcResult } from 'librpc-web-mod'

import { makeImageArrays } from './makeImageArrays'

import type {
  ClickMapItem,
  RenderArgsDeserializedWithFeatures,
  SNPCoverageArrays,
} from './types'
import type { BaseCoverageBin, SkipMap } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'

// Convert Feature map to structure-of-arrays format for makeImageArrays
function featuresToArrays(features: Map<string, Feature>): SNPCoverageArrays {
  const skipmap: SkipMap = {}
  const nonSkipFeatures: Feature[] = []

  for (const feature of features.values()) {
    if (feature.get('type') === 'skip') {
      skipmap[feature.id()] = {
        start: feature.get('start'),
        end: feature.get('end'),
        strand: feature.get('strand'),
        score: feature.get('score'),
        effectiveStrand: feature.get('effectiveStrand'),
        feature,
      }
    } else {
      nonSkipFeatures.push(feature)
    }
  }

  const count = nonSkipFeatures.length
  const starts = new Int32Array(count)
  const ends = new Int32Array(count)
  const scores = new Float32Array(count)
  const snpinfo: BaseCoverageBin[] = new Array(count)

  for (let i = 0; i < count; i++) {
    const feature = nonSkipFeatures[i]!
    starts[i] = feature.get('start')
    ends[i] = feature.get('end')
    scores[i] = feature.get('score')
    snpinfo[i] = feature.get('snpinfo')
  }

  return { starts, ends, scores, snpinfo, skipmap }
}

export async function renderSNPCoverageToCanvas(
  props: RenderArgsDeserializedWithFeatures,
) {
  const { features, height, regions, bpPerPx, adapterConfig } = props
  const region = regions[0]!
  const width = (region.end - region.start) / bpPerPx
  const adapterId = adapterConfig?.adapterId ?? 'unknown'

  // Convert features to arrays and delegate to makeImageArrays
  const featureArrays = featuresToArrays(features)

  const { reducedFeatures, skipmap, coords, items, ...rest } =
    await renderToAbstractCanvas(width, height, props, ctx =>
      makeImageArrays(ctx, { ...props, featureArrays }),
    )

  const serialized = {
    ...rest,
    features: reducedFeatures.map((f, idx) => ({
      uniqueId: `${adapterId}-${f.start}-${idx}`,
      ...f,
    })),
    skipFeatures: Object.entries(skipmap).map(([key, skip]) => ({
      uniqueId: key,
      type: 'skip',
      refName: region.refName,
      start: skip.start,
      end: skip.end,
      strand: skip.strand,
      score: skip.score,
      effectiveStrand: skip.effectiveStrand,
    })),
    clickMap: buildClickMap(coords, items),
    height,
    width,
  }

  return rpcResult(serialized, collectTransferables(rest))
}

function buildClickMap(coords: number[], items: ClickMapItem[]) {
  const flatbush = new Flatbush(Math.max(items.length, 1))
  if (coords.length) {
    for (let i = 0; i < coords.length; i += 4) {
      flatbush.add(coords[i]!, coords[i + 1]!, coords[i + 2], coords[i + 3])
    }
  } else {
    flatbush.add(0, 0)
  }
  flatbush.finish()
  return {
    flatbush: flatbush.data,
    items,
  }
}
