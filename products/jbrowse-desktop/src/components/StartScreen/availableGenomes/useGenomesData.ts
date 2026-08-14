import { fetchJson } from '@jbrowse/core/util'
import { useFetch } from '@jbrowse/core/util/useFetch'

import { matchesAllTokens, searchTokens } from './searchTokens.ts'

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

/**
 * Whether the NCBI status filter means anything for the rows on screen. The
 * fields it reads — a GC[AF] accession, a refseq category — exist only on
 * GenArk/NCBI rows, so the UCSC main genomes have nothing to filter on, unless
 * the search spans every group and its hits are mostly GenArk.
 *
 * One predicate, read both by the settings menu that offers the filter and by
 * the derivation that applies it. As two separate readings they drifted, and the
 * dead end was reachable in three clicks: filter to RefSeq with "search all
 * groups" on, then turn it off. The menu item disappeared while the filter kept
 * being applied, so `refseq` sat there testing UCSC db names for a `GCF_` prefix
 * they never carry — an empty table with nothing left on screen to undo it.
 */
export function ncbiFilterApplies(typeOption: string, allGroups: boolean) {
  return typeOption !== 'ucsc' || allGroups
}

// Reads the accession rather than ncbiName because search-index rows carry no
// ncbiName. The two agree on the GC[AF]_ prefix for every GenArk row; UCSC rows
// have neither, and a db name like ailMel1 matches no prefix, so they stay out
// of both halves exactly as before.
function applyFilter(rows: Entry[], filterOption: FilterOption) {
  return filterOption === 'refseq'
    ? rows.filter(r => r.accession.startsWith('GCF_'))
    : filterOption === 'genbank'
      ? rows.filter(r => r.accession.startsWith('GCA_'))
      : filterOption === 'designatedReference'
        ? rows.filter(r => r.ncbiRefSeqCategory === 'reference genome')
        : rows
}

/**
 * The status and favorites filters, which apply to a group's rows and to
 * cross-group search hits alike. Search is not part of this: the group path
 * searches here, but the global path has already searched the index.
 */
export function applyRowFilters({
  rows,
  filterOption,
  showOnlyFavs,
  favoriteIds,
}: {
  rows: Entry[]
  filterOption: FilterOption
  showOnlyFavs: boolean
  favoriteIds: Set<string>
}) {
  return applyFilter(rows, filterOption).filter(
    row => !showOnlyFavs || favoriteIds.has(row.accession),
  )
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
  return applyRowFilters({
    rows,
    filterOption,
    showOnlyFavs,
    favoriteIds,
  }).filter(row => matchesAllTokens(haystack(row), tokens))
}

export function useGenomesData({
  searchQuery,
  filterOption,
  showOnlyFavs,
  favoriteIds,
  url,
}: {
  searchQuery: string
  filterOption: FilterOption
  showOnlyFavs: boolean
  favoriteIds: Set<string>
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
      favoriteIds,
    }),
    allData,
    error,
    isLoading,
  }
}
