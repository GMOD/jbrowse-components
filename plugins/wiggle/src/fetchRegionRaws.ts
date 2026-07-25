import { featuresToRaw } from './util.ts'

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
// coalesce (BigWig) serve every region in a single pass, which is the whole
// point of handing them all the regions at once: a collapsed-intron or
// whole-genome view turns N R-tree traversals and N sets of range requests into
// one. Adapters without the batch method fall back to the per-region loop, and
// non-array adapters to plain features — no behavior change for either.
//
// Shared by the single-source RPC executor and MultiWiggleAdapter's per-subtrack
// fan-out so the two can't drift on which fast path they take.
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
            adapter.getFeaturesArray(region, opts).then(featuresToRaw),
          ),
        )
}
