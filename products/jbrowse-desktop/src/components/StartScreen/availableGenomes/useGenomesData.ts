import { useMemo } from 'react'

import useSWR from 'swr'

import { fetchjson } from '../util'

import type { Fav, UCSCListGenome } from '../types'

interface Entry {
  jbrowseConfig: string
  accession: string
  commonName: string
  ncbiAssemblyName: string
  ncbiName: string
  ncbiRefSeqCategory: string
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
  const { data: genArkData, error: genArkError } = useSWR(url, () =>
    url ? (fetchjson(url) as Promise<Entry[]>) : undefined,
  )

  const { data: mainGenomesData, error: mainGenomesError } = useSWR(
    'ucscGenomeList',
    () =>
      fetchjson('https://jbrowse.org/ucsc/list.json') as Promise<{
        ucscGenomes: Record<string, UCSCListGenome>
      }>,
  )

  const preRows = useMemo(() => {
    if (typeOption === 'mainGenomes') {
      return mainGenomesData
        ? Object.entries(mainGenomesData.ucscGenomes).map(([key, value]) => ({
            ...value,
            id: key,
            name: key,
            accession: key,
            commonName: value.organism,
            jbrowseConfig: `https://jbrowse.org/ucsc/${key}/config.json`,
          }))
        : undefined
    } else {
      return genArkData
        ?.map(r => ({
          ...r,
          id: r.accession,
        }))
        .filter(f => !!f.id)
    }
  }, [typeOption, genArkData, mainGenomesData])

  const rows = useMemo(() => {
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
  }, [filterOption, preRows, typeOption])

  const favs = new Set(favorites.map(r => r.id))
  const searchFilteredRows = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    return !query
      ? rows
      : rows?.filter(row => {
          const searchText = [
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
          return searchText.includes(query)
        }) || []
  }, [rows, searchQuery])

  const data = showOnlyFavs
    ? searchFilteredRows?.filter(row => favs.has(row.id)) || []
    : searchFilteredRows || []
  return {
    data: data.sort((a, b) => {
      return 'orderKey' in a && 'orderKey' in b ? a.orderKey - b.orderKey : 0
    }),
    genArkError,
    mainGenomesError,
    genArkData,
    mainGenomesData,
    favs,
  }
}
