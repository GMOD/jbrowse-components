import { useMemo } from 'react'

import useSWR from 'swr'

import { fetchjson } from '../util.tsx'

import type { Entry } from './getColumnDefinitions.tsx'
import type { Fav } from '../types.ts'

interface RawEntry extends Entry {
  orderKey: number
}

export function useGenomesData({
  searchQuery,
  filterOption,
  typeOption,
  showOnlyFavs,
  favorites,
  url = '',
}: {
  searchQuery: string
  filterOption: string
  typeOption: string
  showOnlyFavs: boolean
  favorites: Fav[]
  url?: string
}) {
  const { data, error: dataError } = useSWR(url, () =>
    url
      ? (fetchjson(url) as Promise<
          RawEntry[] | { ucscGenomes: Record<string, RawEntry> }
        >)
      : undefined,
  )

  const rows = useMemo(() => {
    if (!data) {
      return undefined
    }
    // Handle both array format and object format with ucscGenomes key
    const preRows = Array.isArray(data)
      ? data.map(r => ({ ...r, id: r.accession })).filter(f => !!f.id)
      : Object.values(data.ucscGenomes)

    let filtered = preRows
    if (typeOption !== 'mainGenomes') {
      if (filterOption === 'refseq') {
        filtered = preRows.filter(
          r => 'ncbiName' in r && r.ncbiName.startsWith('GCF_'),
        )
      } else if (filterOption === 'genbank') {
        filtered = preRows.filter(
          r => 'ncbiName' in r && r.ncbiName.startsWith('GCA_'),
        )
      } else if (filterOption === 'designatedReference') {
        filtered = preRows.filter(
          r =>
            'ncbiRefSeqCategory' in r &&
            r.ncbiRefSeqCategory === 'reference genome',
        )
      }
    }
    return filtered.sort((a, b) =>
      'orderKey' in a && 'orderKey' in b ? a.orderKey - b.orderKey : 0,
    )
  }, [data, filterOption, typeOption])

  const favs = useMemo(() => new Set(favorites.map(r => r.id)), [favorites])
  const searchFilteredRows = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    return !query
      ? rows
      : rows?.filter(row =>
          [
            row.commonName,
            row.accession,
            'scientificName' in row ? row.scientificName : '',
            'ncbiAssemblyName' in row ? row.ncbiAssemblyName : '',
            'organism' in row ? row.organism : '',
            'description' in row ? row.description : '',
            'name' in row ? row.name : '',
          ]
            .join(' ')
            .toLowerCase()
            .includes(query),
        )
  }, [rows, searchQuery])

  return {
    data: showOnlyFavs
      ? (searchFilteredRows?.filter(row => favs.has(row.id)) ?? [])
      : (searchFilteredRows ?? []),
    error: dataError,
    favs,
  }
}
