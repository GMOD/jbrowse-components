import { fetchJson, useFetch } from '@jbrowse/core/util'

import type { Entry } from './getColumnDefinitions.tsx'
import type { Fav } from '../types.ts'

type RawEntry = Entry & { orderKey?: number }
type RawData = RawEntry[] | { ucscGenomes: Record<string, RawEntry> }

function normalizeEntries(data: RawData): RawEntry[] {
  return Array.isArray(data)
    ? data.map(r => ({ ...r, id: r.accession })).filter(r => r.id)
    : Object.values(data.ucscGenomes)
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
}: {
  searchQuery: string
  filterOption: FilterOption
  showOnlyFavs: boolean
  favorites: Fav[]
  url?: string
}): { data: RawEntry[]; error: unknown } {
  const { data, error } = useFetch<RawData>(
    url,
    (u: string) => fetchJson<RawData>(u),
    { errorRetryCount: 3 },
  )

  const rows = data
    ? applyFilter(normalizeEntries(data), filterOption).sort(byOrderKey)
    : undefined

  const query = searchQuery.toLowerCase().trim()
  const searchFilteredRows = query
    ? rows?.filter(row => matchesSearch(row, query))
    : rows

  const favSet = new Set(favorites.map(r => r.id))
  const result = showOnlyFavs
    ? searchFilteredRows?.filter(row => favSet.has(row.id))
    : searchFilteredRows

  return { data: result ?? [], error }
}
