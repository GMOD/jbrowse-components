import { createStatusFanOut } from '@jbrowse/core/util'

import { isMultiSource } from './multiSourceAdapter.ts'
import { featuresToRaw, groupFeaturesBySource } from './util.ts'

import type { MultiSourceFetchOpts } from './multiSourceAdapter.ts'
import type { RawFeatureArrays } from './util.ts'
import type { WiggleAdapterOptions } from './wiggleAdapterOptions.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

/**
 * Whether the adapter answers in typed arrays rather than features, one
 * `RawFeatureArrays` per region, aligned to input order. BigWig reads every
 * region in one bbi pass.
 */
export function servesArrays(
  adapter: BaseFeatureDataAdapter,
): adapter is BaseFeatureDataAdapter & {
  getFeatureArrays(
    regions: Region[],
    opts: WiggleAdapterOptions,
  ): Promise<RawFeatureArrays[]>
} {
  return 'getFeatureArrays' in adapter
}

// One RawFeatureArrays per region, aligned to input order. A non-array
// adapter serves plain features, whose `yField` may be a `jexl:` expression
// the worker's instance evaluates.
export function fetchRegionRaws(
  adapter: BaseFeatureDataAdapter,
  regions: Region[],
  opts: WiggleAdapterOptions,
  jexl?: JexlInstance,
): Promise<RawFeatureArrays[]> {
  return servesArrays(adapter)
    ? adapter.getFeatureArrays(regions, opts)
    : featuresPerRegion(adapter, regions, opts).then(perRegion =>
        perRegion.map(features => featuresToRaw(features, opts.yField, jexl)),
      )
}

// One fetch per region, concurrently, each on its own status line: the first
// to finish would otherwise blank the label the others still need.
function featuresPerRegion(
  adapter: BaseFeatureDataAdapter,
  regions: Region[],
  opts: WiggleAdapterOptions,
) {
  const slot = createStatusFanOut(opts.statusCallback)
  return Promise.all(
    regions.map(region =>
      adapter.getFeaturesArray(region, { ...opts, statusCallback: slot() }),
    ),
  )
}

// Every source's arrays, `raws` aligned to `regions`, for the render fetch and
// the clustering matrix alike. An adapter serving typed arrays carries one
// unnamed signal; a plain feature adapter carrying several in one file
// (bedMethyl, a bedGraph with a source column) is grouped on `source`, and a
// source is listed once it appears in any region.
export async function fetchSourceRaws(
  adapter: BaseFeatureDataAdapter,
  regions: Region[],
  opts: MultiSourceFetchOpts,
  jexl?: JexlInstance,
): Promise<{ source: string; raws: RawFeatureArrays[] }[]> {
  if (isMultiSource(adapter)) {
    return adapter.getMultiSourceFeatureArraysMulti(regions, opts)
  }
  if (servesArrays(adapter)) {
    return [{ source: '', raws: await fetchRegionRaws(adapter, regions, opts) }]
  }
  const perRegion = await featuresPerRegion(adapter, regions, opts)
  const groupsPerRegion = perRegion.map(f => groupFeaturesBySource(f))
  const sources = new Set(groupsPerRegion.flatMap(groups => [...groups.keys()]))
  return [...sources].map(source => ({
    source,
    raws: groupsPerRegion.map(groups =>
      featuresToRaw(groups.get(source) ?? [], opts.yField, jexl),
    ),
  }))
}
