import { fetchJson } from '@jbrowse/core/util'
import { useFetch } from '@jbrowse/core/util/useFetch'

import { matchesAllTokens, searchTokens } from './searchTokens.ts'

import type { Fav } from '../types.ts'
import type { Entry } from './getColumnDefinitions.tsx'

// Every field the table can display for either group, so a search matches
// whatever the user can see — and `useSearchHighlight` can then find that match
// in the DOM. Array.join() renders the fields a group omits as '', not
// 'undefined'.
//
// sourceName and pairedAccession are the two halves' alias identifiers: they
// name the same assembly under the other authority's accession (hg38's
// sourceName carries GCA_000001405.15; a GCF entry's pairedAccession its GCA).
// Both are shown as columns under "Show all columns", so a hit stays findable.
function haystack(row: Entry) {
  return [
    row.name,
    row.commonName,
    row.scientificName,
    row.organism,
    row.description,
    row.accession,
    row.ncbiAssemblyName,
    row.assemblyStatus,
    row.submitterOrg,
    row.sourceName,
    row.pairedAccession,
  ].join(' ')
}

// UCSC's preferred ordering (human first, then by popularity). GenArk entries
// carry no orderKey and keep the order the endpoint served them in.
function byOrderKey(a: Entry, b: Entry) {
  return (a.orderKey ?? 0) - (b.orderKey ?? 0)
}

export type FilterOption = 'all' | 'refseq' | 'genbank' | 'designatedReference'

function applyFilter(rows: Entry[], filterOption: FilterOption) {
  return filterOption === 'refseq'
    ? rows.filter(r => r.ncbiName?.startsWith('GCF_'))
    : filterOption === 'genbank'
      ? rows.filter(r => r.ncbiName?.startsWith('GCA_'))
      : filterOption === 'designatedReference'
        ? rows.filter(r => r.ncbiRefSeqCategory === 'reference genome')
        : rows
}

/**
 * Every row of a group that is valid to launch and display, in the order the
 * table should show them. Sorted into a copy, never in place: callers keep this
 * array, and filterGenomes passes it straight through for filterOption 'all'.
 */
export function groupRows(data: Entry[] | undefined) {
  return (data ?? []).filter(r => r.accession).toSorted(byOrderKey)
}

/** The subset of a group the current search/status/favorites leave visible. */
export function filterGenomes({
  rows,
  searchQuery,
  filterOption,
  showOnlyFavs,
  favoriteIds,
}: {
  rows: Entry[]
  searchQuery: string
  filterOption: FilterOption
  showOnlyFavs: boolean
  favoriteIds: Set<string>
}) {
  const tokens = searchTokens(searchQuery)
  return applyFilter(rows, filterOption).filter(
    row =>
      matchesAllTokens(haystack(row), tokens) &&
      (!showOnlyFavs || favoriteIds.has(row.accession)),
  )
}

export function useGenomesData({
  searchQuery,
  filterOption,
  showOnlyFavs,
  favorites,
  url,
}: {
  searchQuery: string
  filterOption: FilterOption
  showOnlyFavs: boolean
  favorites: Fav[]
  url?: string
}): {
  data: Entry[]
  allData: Entry[]
  error: unknown
  isLoading: boolean
} {
  // no explicit type argument: it would pin `Data` and leave the key type to its
  // loose default, costing the fetcher its typed `u`
  const { data, error, isLoading } = useFetch(url, (u: string) =>
    fetchJson<Entry[]>(u),
  )

  // allData is the whole group, so a multi-selection built up across searches
  // still resolves the rows the current filters hide
  const allData = groupRows(data)
  return {
    data: filterGenomes({
      rows: allData,
      searchQuery,
      filterOption,
      showOnlyFavs,
      favoriteIds: new Set(favorites.map(r => r.id)),
    }),
    allData,
    error,
    isLoading,
  }
}
