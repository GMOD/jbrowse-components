export interface BaseOptions {
  stopToken?: string
  bpPerPx?: number
  sessionId?: string
  statusCallback?: (message: string) => void
  headers?: Record<string, string>
  statsEstimationMode?: boolean
}

export type SearchType = 'full' | 'prefix' | 'exact'

export interface BaseTextSearchArgs {
  queryString: string
  searchType?: SearchType
  stopToken?: string
  limit?: number
  pageNumber?: number
}
