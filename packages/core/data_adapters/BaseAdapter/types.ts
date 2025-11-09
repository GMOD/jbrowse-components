export interface BaseOptions {
  stopToken?: string
  bpPerPx?: number
  sessionId?: string
  signal?: AbortSignal
  statusCallback?: (message: string) => void
  headers?: Record<string, string>
}

export type SearchType = 'full' | 'prefix' | 'exact'

export interface BaseTextSearchArgs {
  queryString: string
  searchType?: SearchType
  stopToken?: string
  limit?: number
  pageNumber?: number
}

export interface FeatureDensityStats {
  featureDensity?: number
  fetchSizeLimit?: number
  bytes?: number
}
