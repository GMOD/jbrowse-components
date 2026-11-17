import {
  applyNcbiFilter,
  isSearching,
  useGenomesData,
} from './useGenomesData.ts'
import { useGlobalSearch } from './useGlobalSearch.ts'

import type { Entry } from './getColumnDefinitions.tsx'
import type { FilterOption } from './useGenomesData.ts'

/**
 * Everything the table needs about the rows in play, from whichever of the two
 * sources is serving them: the selected group's list while browsing, or the
 * cross-group search index while a query is typed.
 *
 * The sources differ in more than their rows — in what the row count is a
 * fraction of, and what "still loading" means. Deciding all of that per source
 * in one place keeps a new filter from being wired into only one of them.
 */
interface ResultSet {
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
  hasSearched,
  filterOption,
}: {
  url?: string
  categoriesLoading: boolean
  searchQuery: string
  hasSearched: boolean
  filterOption: FilterOption
}): ResultSet {
  const {
    data,
    allData,
    error,
    isLoading: genomesLoading,
  } = useGenomesData({ filterOption, url })

  const {
    rows: globalRows,
    resolveAccessions,
    indexedCount,
    isLoading: globalLoading,
    error: globalError,
  } = useGlobalSearch({ enabled: hasSearched, searchQuery })

  // Against the whole group, in the group's own order, then the index for the
  // search hits from other groups that clearing the query took off screen.
  const resolveSelection = (accessions: Set<string>) => {
    const inGroup = allData.filter(row => accessions.has(row.accession))
    const found = new Set(inGroup.map(row => row.accession))
    const elsewhere = new Set([...accessions].filter(a => !found.has(a)))
    return elsewhere.size
      ? [...inGroup, ...resolveAccessions(elsewhere)]
      : inGroup
  }

  return isSearching(searchQuery)
    ? {
        rows: applyNcbiFilter(globalRows, filterOption),
        resolveSelection,
        isLoading: globalLoading,
        error: globalError,
        scopeTotal: indexedCount,
        scopeLabel: 'across all groups',
        isGlobal: true,
      }
    : {
        rows: data,
        resolveSelection,
        // an unresolved url is the pre-fetch state, not an idle one
        isLoading: categoriesLoading || genomesLoading || !url,
        error,
        scopeTotal: allData.length,
        scopeLabel: 'in this group',
        isGlobal: false,
      }
}
