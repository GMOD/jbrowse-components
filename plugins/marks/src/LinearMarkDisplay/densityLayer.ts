import Flatbush from '@jbrowse/core/util/flatbush'

import type { MarkRegionData, StoredLayer } from './markList.ts'
import type { FeatureDensity } from '@jbrowse/core/data_adapters/BaseAdapter'

const EMPTY: StoredLayer = {
  count: 0,
  skipped: 0,
  x: new Uint32Array(0),
  x2: new Uint32Array(0),
  featureIndex: new Uint32Array(0),
  yMin: Infinity,
  yMax: -Infinity,
}

/**
 * One region's density read as the layer a `bar` mark draws: the sidecar's own
 * intervals as `x`/`x2` and its levels as `y`, one packed colour per bar, and
 * the Flatbush the hover reads. The sidecar's rows are what a wiggle track
 * would draw of the same bigWig at the same bp/px — the zoom level the adapter
 * picked — so nothing is resampled on the way through.
 */
export function densityLayer(
  { starts, ends, scores }: FeatureDensity,
  color: number,
): StoredLayer {
  const count = starts.length
  const featureIndex = new Uint32Array(count)
  const colors = new Uint32Array(count)
  const fb =
    count > 0 ? new Flatbush(count, undefined, Float64Array) : undefined
  let yMin = Infinity
  let yMax = -Infinity
  for (let i = 0; i < count; i++) {
    const v = scores[i]!
    featureIndex[i] = i
    colors[i] = color
    yMin = v < yMin ? v : yMin
    yMax = v > yMax ? v : yMax
    fb?.add(starts[i]!, v, ends[i], v)
  }
  fb?.finish()
  return {
    count,
    skipped: 0,
    x: starts,
    x2: ends,
    y: scores,
    color: colors,
    featureIndex,
    yMin,
    yMax,
    flatbush: fb,
  }
}

/**
 * A region's payload with the density layer at `markIndex` and every other
 * mark empty: past the byte budget the features are the ones nothing fetched.
 */
export function densityRegionData(
  density: FeatureDensity,
  markCount: number,
  markIndex: number,
  color: number,
): MarkRegionData {
  const layer = densityLayer(density, color)
  return {
    layers: Array.from({ length: markCount }, (_, i) =>
      i === markIndex ? layer : EMPTY,
    ),
  }
}
