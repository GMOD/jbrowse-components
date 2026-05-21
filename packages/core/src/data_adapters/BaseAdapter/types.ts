import type { StopToken } from '../../util/stopToken.ts'

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
  headers?: Record<string, string>
  statsEstimationMode?: boolean
}

export type SearchType = 'full' | 'prefix' | 'exact'

export interface BaseTextSearchArgs {
  queryString: string
  searchType?: SearchType
  stopToken?: StopToken
  limit?: number
  pageNumber?: number
}

export interface FeatureDensityStats {
  featureDensity?: number
  fetchSizeLimit?: number
  bytes?: number
}
