import { fetchJson } from '@jbrowse/core/util'
import { useFetch } from '@jbrowse/core/util/useFetch'

import {
  SEARCH_INDEX_URL,
  entriesForAccessions,
  searchAllGroups,
} from './searchIndex.ts'

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
    (u: string, signal: AbortSignal) =>
      fetchJson<Parameters<typeof searchAllGroups>[0]>(u, { signal }),
  )

  return {
    rows: searchAllGroups(data, searchQuery),
    resolveAccessions: (accessions: Set<string>) =>
      entriesForAccessions(data, accessions),
    indexedCount: data?.length ?? 0,
    isLoading,
    error,
  }
}
