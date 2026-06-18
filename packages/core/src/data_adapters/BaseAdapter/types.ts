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
  statusCallback?: (message: string) => void
  // Determinate progress for a long operation, as units done out of a total
  // with a phase label (`current`/`total` are units-agnostic — bytes for a
  // download, blocks for an unzip, features for a scan). Adapters wrap the raw
  // byte counts from the index reader (@gmod/tabix, @gmod/bam, @gmod/cram) into
  // this and callers forward it to `statusCallback` to render a bar.
  onProgress?: (progress: StatusWithProgress) => void
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
  featureDensity?: number
  fetchSizeLimit?: number
  bytes?: number
}
