import { useMemo } from 'react'

import useSWR from 'swr'

import { fetchjson } from '../util.tsx'

import type { Fav } from '../types.ts'

interface Entry {
  jbrowseConfig: string
  jbrowseMinimalConfig?: string
  accession: string
  commonName: string
  ncbiAssemblyName: string
  ncbiName: string
  ncbiRefSeqCategory: string
  orderKey: number
  id: string
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
          Entry[] | { ucscGenomes: Record<string, Entry> }
        >)
      : undefined,
  )

  const preRows = useMemo(() => {
    if (!data) {
      return undefined
    }
    // Handle both array format and object format with ucscGenomes key
    if (Array.isArray(data)) {
      return data
        .map(r => ({
          ...r,
          id: r.accession,
        }))
        .filter(f => !!f.id)
    } else if ('ucscGenomes' in data) {
      return Object.values(data.ucscGenomes)
    }
    return undefined
  }, [data])

  const rows = useMemo(() => {
    return (function () {
      if (typeOption === 'mainGenomes') {
        return preRows
      } else if (filterOption === 'refseq') {
        return preRows?.filter(
          r => 'ncbiName' in r && r.ncbiName.startsWith('GCF_'),
        )
      } else if (filterOption === 'genbank') {
        return preRows?.filter(
          r => 'ncbiName' in r && r.ncbiName.startsWith('GCA_'),
        )
      } else if (filterOption === 'designatedReference') {
        return preRows?.filter(
          r =>
            'ncbiRefSeqCategory' in r &&
            r.ncbiRefSeqCategory === 'reference genome',
        )
      } else {
        return preRows
      }
    })()?.sort((a, b) =>
      'orderKey' in a && 'orderKey' in b ? a.orderKey - b.orderKey : 0,
    )
  }, [filterOption, preRows, typeOption])

  const favs = new Set(favorites.map(r => r.id))
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
        ) || []
  }, [rows, searchQuery])

  return {
    data: showOnlyFavs
      ? searchFilteredRows?.filter(row => favs.has(row.id)) || []
      : searchFilteredRows || [],
    error: dataError,
    favs,
  }
}
