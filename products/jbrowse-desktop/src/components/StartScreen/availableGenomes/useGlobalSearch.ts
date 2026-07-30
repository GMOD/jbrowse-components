import { fetchJson } from '@jbrowse/core/util'
import { useFetch } from '@jbrowse/core/util/useFetch'

import { SEARCH_INDEX_URL, searchAllGroups } from './searchIndex.ts'

/**
 * Searches every group at once, via the prebuilt index of all ~50k assemblies.
 * The index is ~7.5MB, so it is fetched only once the user asks for a
 * cross-group search — a null key means useFetch does not fetch at all.
 */
export function useGlobalSearch({
  enabled,
  searchQuery,
}: {
  enabled: boolean
  searchQuery: string
}) {
  const { data, error, isLoading } = useFetch(
    enabled ? SEARCH_INDEX_URL : undefined,
    () => fetchJson<Parameters<typeof searchAllGroups>[0]>(SEARCH_INDEX_URL),
  )

  return {
    rows: searchAllGroups(data, searchQuery),
    indexedCount: data?.length ?? 0,
    isLoading,
    error,
  }
}
