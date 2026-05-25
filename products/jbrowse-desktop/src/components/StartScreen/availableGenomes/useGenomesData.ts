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
type TypeOption = string

function applyFilter(
  rows: RawEntry[],
  filterOption: FilterOption,
  typeOption: TypeOption,
): RawEntry[] {
  let filtered = rows
  if (typeOption !== 'mainGenomes') {
    if (filterOption === 'refseq') {
      filtered = rows.filter(r => r.ncbiName.startsWith('GCF_'))
    } else if (filterOption === 'genbank') {
      filtered = rows.filter(r => r.ncbiName.startsWith('GCA_'))
    } else if (filterOption === 'designatedReference') {
      filtered = rows.filter(r => r.ncbiRefSeqCategory === 'reference genome')
    }
  }
  return filtered
}

export function useGenomesData({
  searchQuery,
  filterOption,
  typeOption,
  showOnlyFavs,
  favorites,
  url,
}: {
  searchQuery: string
  filterOption: FilterOption
  typeOption: TypeOption
  showOnlyFavs: boolean
  favorites: Fav[]
  url?: string
}): { data: RawEntry[]; error: unknown } {
  const { data, error } = useFetch<RawData>(url, (u: string) =>
    fetchJson<RawData>(u),
  )

  const rows = data
    ? applyFilter(normalizeEntries(data), filterOption, typeOption).sort(
        byOrderKey,
      )
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
