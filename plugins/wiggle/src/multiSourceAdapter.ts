import type { RawFeatureArrays } from './util.ts'
import type { WiggleAdapterOptions } from './wiggleAdapterOptions.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'

export interface MultiSourceFetchOpts extends WiggleAdapterOptions {
  // Narrows the fan-out to the named subtracks. Absent means every subtrack.
  sources?: { name: string }[]
}

// Multi-source wiggle adapters (MultiWiggleAdapter) fan out to inner adapters
// themselves and expose this method, handing each of them every region at once
// so a subtrack whose adapter coalesces reads (BigWig) serves the whole view in
// one pass instead of one pass per region. `raws` is aligned to the requested
// regions and carries absolute genomic coordinates; a caller never has to group
// features by source, which would be another walk over already-typed-array data.
//
// The per-subtrack status fan-out that keeps N concurrent downloads from
// clobbering one status field lives inside the adapter, so callers pass their
// raw statusCallback through.
export interface MultiSourceWiggleAdapter extends BaseFeatureDataAdapter {
  getMultiSourceFeatureArraysMulti(
    regions: Region[],
    opts: MultiSourceFetchOpts,
  ): Promise<{ source: string; raws: RawFeatureArrays[] }[]>
}

// Shared by the render RPC and the clustering score matrix so the two take the
// same branch: a track backed by real per-subtrack files gets typed arrays from
// both, and only an adapter carrying several sources in one file (bedMethyl, a
// bedGraph with a source column) falls back to grouping features.
export function isMultiSource(
  adapter: BaseFeatureDataAdapter,
): adapter is MultiSourceWiggleAdapter {
  return 'getMultiSourceFeatureArraysMulti' in adapter
}
