import type { StopToken } from '../../util/stopToken'

export interface BaseOptions {
  stopToken?: StopToken
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
  stopToken?: StopToken
  limit?: number
  pageNumber?: number
}
