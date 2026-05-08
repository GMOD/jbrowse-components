import useSWR, { type SWRConfiguration, type SWRResponse } from 'swr'

import type { Key, Fetcher } from 'swr'

// Wrap useSWR with the project default of no automatic refetching.
// Most JBrowse data sources are stable for the lifetime of the dialog or
// widget that opens them — once fetched, we want the cached value, not
// background revalidation.
export function useFetch<Data = unknown, Err = unknown, K extends Key = Key>(
  key: K,
  fetcher: Fetcher<Data, K> | null,
  options?: SWRConfiguration<Data, Err>,
): SWRResponse<Data, Err> {
  return useSWR(key, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    ...options,
  })
}
