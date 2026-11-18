import { fetchJson } from '@jbrowse/core/util'
import { parseSearchQuery } from '@jbrowse/core/util/searchText'
import { useFetch } from '@jbrowse/core/util/useFetch'

import type { Entry } from './getColumnDefinitions.tsx'

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
 * a search is running across every group and its hits are mostly GenArk.
 *
 * One predicate, read both by the settings menu that offers the filter and by
 * the derivation that applies it, so a filter whose menu item is gone cannot
 * go on silently emptying the table.
 */
export function ncbiFilterApplies(typeOption: string, searchQuery: string) {
  return typeOption !== 'ucsc' || isSearching(searchQuery)
}

// A query searches every group; with no terms, as while a lone `-` or `"` is
// typed, the table browses the selected one
export function isSearching(searchQuery: string) {
  return parseSearchQuery(searchQuery).length > 0
}

// Reads the accession rather than ncbiName because search-index rows carry no
// ncbiName. The two agree on the GC[AF]_ prefix for every GenArk row; UCSC rows
// have neither, and a db name like ailMel1 matches no prefix, so they stay out
// of both halves exactly as before.
export function applyNcbiFilter(rows: Entry[], filterOption: FilterOption) {
  return filterOption === 'refseq'
    ? rows.filter(r => r.accession.startsWith('GCF_'))
    : filterOption === 'genbank'
      ? rows.filter(r => r.accession.startsWith('GCA_'))
      : filterOption === 'designatedReference'
        ? rows.filter(r => r.ncbiRefSeqCategory === 'reference genome')
        : rows
}

/**
 * Every row of a group that is valid to launch and display, in the order the
 * table should show them. Sorted into a copy, never in place: callers keep this
 * array, and applyNcbiFilter passes it straight through for filterOption 'all'.
 */
export function groupRows(data: Entry[] | undefined) {
  return (data ?? []).filter(r => r.accession).toSorted(byOrderKey)
}

export function useGenomesData({
  filterOption,
  url,
}: {
  filterOption: FilterOption
  url?: string
}): {
  data: Entry[]
  allData: Entry[]
  error: unknown
  isLoading: boolean
} {
  // no explicit type argument: it would pin `Data` and leave the key type to its
  // loose default, costing the fetcher its typed `u`
  const { data, error, isLoading } = useFetch(
    url,
    (u: string, signal: AbortSignal) => fetchJson<Entry[]>(u, { signal }),
  )

  // allData is the whole group, so a multi-selection still resolves the rows
  // the NCBI filter hides
  const allData = groupRows(data)
  return {
    data: applyNcbiFilter(allData, filterOption),
    allData,
    error,
    isLoading,
  }
}
