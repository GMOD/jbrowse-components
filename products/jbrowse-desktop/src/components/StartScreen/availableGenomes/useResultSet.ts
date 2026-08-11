import { applyRowFilters, useGenomesData } from './useGenomesData.ts'
import { useGlobalSearch } from './useGlobalSearch.ts'

import type { Entry } from './getColumnDefinitions.tsx'
import type { FilterOption } from './useGenomesData.ts'

/**
 * Everything the table needs about the rows in play, from whichever of the two
 * sources is serving them: the selected group's list, or the cross-group search
 * index.
 *
 * The sources differ in more than their rows — in what a selection resolves
 * against, what the row count is a fraction of, and what "still loading" means.
 * Deciding all of that per source in one place is deliberate: when these were
 * separate `globalMode ? … : …` expressions scattered down the component, each
 * new filter got wired into one branch and silently skipped in the other.
 */
export interface ResultSet {
  /** filtered and ready to sort and paginate */
  rows: Entry[]
  /** the entries for a selection, which outlives the query that surfaced them */
  resolveSelection: (accessions: Set<string>) => Entry[]
  isLoading: boolean
  error: unknown
  /** what `rows` is a subset of, and what to call that scope */
  scopeTotal: number
  scopeLabel: string
  /** cross-group rows come from many groups, so the UI names each row's own */
  isGlobal: boolean
}

export function useResultSet({
  url,
  categoriesLoading,
  searchQuery,
  filterOption,
  showOnlyFavs,
  favoriteIds,
  allGroups,
}: {
  url?: string
  categoriesLoading: boolean
  searchQuery: string
  filterOption: FilterOption
  showOnlyFavs: boolean
  favoriteIds: Set<string>
  allGroups: boolean
}): ResultSet {
  const {
    data,
    allData,
    error,
    isLoading: genomesLoading,
  } = useGenomesData({
    searchQuery,
    filterOption,
    showOnlyFavs,
    favoriteIds,
    url,
  })

  const {
    rows: globalRows,
    resolveAccessions,
    indexedCount,
    isLoading: globalLoading,
    error: globalError,
  } = useGlobalSearch({ enabled: allGroups, searchQuery })

  // the toggle only changes what a *search* covers; with no query there is
  // nothing to search and the selected group is still what to browse
  return allGroups && searchQuery.trim()
    ? {
        // searchAllGroups only searches, so the status and favorites filters
        // have to be applied to its hits here
        rows: applyRowFilters({
          rows: globalRows,
          filterOption,
          showOnlyFavs,
          favoriteIds,
        }),
        resolveSelection: resolveAccessions,
        isLoading: globalLoading,
        error: globalError,
        scopeTotal: indexedCount,
        scopeLabel: 'across all groups',
        isGlobal: true,
      }
    : {
        rows: data,
        // Against the whole group, not the rows the current filters leave. Walks
        // the rows rather than the selection so this is one pass instead of one
        // scan per selected accession, and so it yields them in the group's own
        // order — which is what entriesForAccessions does on the other branch,
        // and the two disagreeing on the order a multi-launch merges in was not
        // a distinction anything wanted.
        resolveSelection: accessions =>
          allData.filter(row => accessions.has(row.accession)),
        // an unresolved url is the pre-fetch state, not an idle one
        isLoading: categoriesLoading || genomesLoading || !url,
        error,
        scopeTotal: allData.length,
        scopeLabel: 'in this group',
        isGlobal: false,
      }
}
