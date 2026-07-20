import { fetchJson, useFetch } from '@jbrowse/core/util'

import type { Entry } from './getColumnDefinitions.tsx'
import type { Fav } from '../types.ts'

type RawEntry = Entry & { orderKey?: number }

// UCSC entries key their taxon by `taxId` (number); GenArk/NCBI entries key
// it by `taxonId` (also a raw JSON number, despite Entry.taxonId being
// typed as string for display purposes). processUcscList.ts in jb2hubs now
// emits both; the `taxId` fallback can be dropped once that's redeployed.
type IncomingEntry = Omit<RawEntry, 'taxonId'> & {
  taxId?: number
  taxonId?: number | string
}
type RawData = IncomingEntry[]

function normalizeEntries(data: RawData): RawEntry[] {
  return data
    .map(r => ({
      ...r,
      id: r.accession,
      taxonId: `${r.taxonId ?? r.taxId ?? ''}`,
    }))
    .filter(r => r.id)
}

function matchesSearch(row: RawEntry, query: string) {
  return [
    row.commonName,
    row.accession,
    row.scientificName,
    row.ncbiAssemblyName,
    row.organism,
    row.description,
    row.name,
  ]
    .join(' ')
    .toLowerCase()
    .includes(query)
}

function byOrderKey(a: RawEntry, b: RawEntry) {
  return a.orderKey !== undefined && b.orderKey !== undefined
    ? a.orderKey - b.orderKey
    : 0
}

export type FilterOption = 'all' | 'refseq' | 'genbank' | 'designatedReference'

function applyFilter(rows: RawEntry[], filterOption: FilterOption): RawEntry[] {
  return filterOption === 'refseq'
    ? rows.filter(r => r.ncbiName.startsWith('GCF_'))
    : filterOption === 'genbank'
      ? rows.filter(r => r.ncbiName.startsWith('GCA_'))
      : filterOption === 'designatedReference'
        ? rows.filter(r => r.ncbiRefSeqCategory === 'reference genome')
        : rows
}

export function useGenomesData({
  searchQuery,
  filterOption,
  showOnlyFavs,
  favorites,
  url,
  cladeTaxonIds,
}: {
  searchQuery: string
  filterOption: FilterOption
  showOnlyFavs: boolean
  favorites: Fav[]
  url?: string
  cladeTaxonIds?: Set<number>
}): {
  data: RawEntry[]
  allData: RawEntry[]
  error: unknown
  isLoading: boolean
} {
  const { data, error, isLoading } = useFetch<RawData>(url, (u: string) =>
    fetchJson<RawData>(u),
  )

  const query = searchQuery.toLowerCase().trim()
  const favSet = new Set(favorites.map(r => r.id))
  // allData is the full normalized group (all row ids valid for launching);
  // data is what the current search/clade/status/favorites filters leave
  // visible. A persisted multi-selection is resolved against allData so rows
  // hidden by the current filter still launch.
  const allData = normalizeEntries(data ?? [])
  const result = applyFilter(allData, filterOption)
    .sort(byOrderKey)
    .filter(
      row =>
        (!query || matchesSearch(row, query)) &&
        (!cladeTaxonIds || cladeTaxonIds.has(Number(row.taxonId))) &&
        (!showOnlyFavs || favSet.has(row.id)),
    )

  return { data: result, allData, error, isLoading }
}
