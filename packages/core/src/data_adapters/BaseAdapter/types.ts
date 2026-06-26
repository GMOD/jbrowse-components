import type { StatusCallback } from '../../util/progress.ts'
import type { StopToken } from '../../util/stopToken.ts'
import type { Region } from '../../util/types/index.ts'

export interface BaseOptions {
  stopToken?: StopToken
  bpPerPx?: number
  sessionId?: string
  trackInstanceId?: string
  // unused in-tree but kept so BaseOptions is structurally assignable to the
  // `Options { signal? }` interfaces in @gmod/tabix, @gmod/bbi-js, etc. that
  // adapters forward opts to
  signal?: AbortSignal
  // The single out-of-band status transport. A plain string is an indeterminate
  // phase label; a StatusWithProgress object adds a determinate fraction
  // (`current`/`total` are units-agnostic — bytes for a download, blocks for an
  // unzip, features for a scan). Adapters wrap the raw byte counts from the
  // index reader (@gmod/tabix, @gmod/bam, @gmod/cram) into this object form.
  statusCallback?: StatusCallback
  headers?: Record<string, string>
  statsEstimationMode?: boolean
  // Used by synteny/comparative adapters in getRefNames to pick which side of
  // the pairing to return refnames for. Single-assembly adapters ignore it.
  assemblyName?: string
  // Used by comparative adapters that expose multiple level-of-detail tiers
  // (e.g. PIF's per-row CIGAR vs merged-block coarse tier). 'auto' uses the
  // adapter's bpPerPx threshold; 'fine'/'coarse' force a specific tier.
  // Adapters without tiering ignore it.
  lodMode?: 'auto' | 'fine' | 'coarse'
}

export interface BaseOptionsWithRegions extends BaseOptions {
  regions?: Region[]
}

export type SearchType = 'full' | 'prefix' | 'exact'

export interface BaseTextSearchArgs {
  queryString: string
  searchType?: SearchType
  stopToken?: StopToken
}

export interface FeatureDensityStats {
  // cheap index-only byte estimate for the requested regions; over the
  // resolved fetchSizeLimit means "too large"
  bytes?: number
  // adapter-defined byte budget (BAM/CRAM/VCF set their own); resolveByteLimit
  // layers it under a user force-load override and over the display config
  fetchSizeLimit?: number
  // Set by self-summarizing adapters (e.g. BigWig, which caps returned data at
  // screen resolution via bbi zoom levels) to declare a region can never be
  // "too large", independent of any byte budget.
  alwaysRender?: boolean
}
