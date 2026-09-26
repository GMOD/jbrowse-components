import { createStatusFanOut } from '@jbrowse/core/util'

import { isMultiSource } from './multiSourceAdapter.ts'
import { featuresToRaw, groupFeaturesBySource } from './util.ts'

import type { MultiSourceFetchOpts } from './multiSourceAdapter.ts'
import type { RawFeatureArrays } from './util.ts'
import type { WiggleAdapterOptions } from './wiggleAdapterOptions.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

// Coalesced multi-region fast path (BigWig): one bbi pass over all regions,
// adjacent on-disk blocks deduped/merged across region boundaries.
function hasFeatureArraysMulti(
  adapter: BaseFeatureDataAdapter,
): adapter is BaseFeatureDataAdapter & {
  getFeatureArraysMulti(
    regions: Region[],
    opts: WiggleAdapterOptions,
  ): Promise<RawFeatureArrays[]>
} {
  return 'getFeatureArraysMulti' in adapter
}

function hasFeatureArrays(
  adapter: BaseFeatureDataAdapter,
): adapter is BaseFeatureDataAdapter & {
  getFeatureArrays(
    region: Region,
    opts: WiggleAdapterOptions,
  ): Promise<RawFeatureArrays>
} {
  return 'getFeatureArrays' in adapter
}

// One RawFeatureArrays per region, aligned to input order. Adapters that
// coalesce (BigWig) serve every region in a single pass; the others fall back
// to a per-region loop, and non-array adapters to plain features.
export function fetchRegionRaws(
  adapter: BaseFeatureDataAdapter,
  regions: Region[],
  opts: WiggleAdapterOptions,
): Promise<RawFeatureArrays[]> {
  return hasFeatureArraysMulti(adapter)
    ? adapter.getFeatureArraysMulti(regions, opts)
    : hasFeatureArrays(adapter)
      ? Promise.all(
          regions.map(region => adapter.getFeatureArrays(region, opts)),
        )
      : Promise.all(
          regions.map(region =>
            adapter
              .getFeaturesArray(region, opts)
              .then(features => featuresToRaw(features, opts.scoreField)),
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
): Promise<{ source: string; raws: RawFeatureArrays[] }[]> {
  if (isMultiSource(adapter)) {
    return adapter.getMultiSourceFeatureArraysMulti(regions, opts)
  }
  if (hasFeatureArraysMulti(adapter) || hasFeatureArrays(adapter)) {
    return [{ source: '', raws: await fetchRegionRaws(adapter, regions, opts) }]
  }
  const slot = createStatusFanOut(opts.statusCallback)
  const groupsPerRegion = await Promise.all(
    regions.map(async region =>
      groupFeaturesBySource(
        await adapter.getFeaturesArray(region, {
          ...opts,
          statusCallback: slot(),
        }),
      ),
    ),
  )
  const sources = new Set(groupsPerRegion.flatMap(groups => [...groups.keys()]))
  return [...sources].map(source => ({
    source,
    raws: groupsPerRegion.map(groups =>
      featuresToRaw(groups.get(source) ?? [], opts.scoreField),
    ),
  }))
}
