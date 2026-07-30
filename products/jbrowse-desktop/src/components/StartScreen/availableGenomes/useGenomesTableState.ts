import { useState } from 'react'

import { useLocalStorage } from '@jbrowse/core/util/hooks'

import type { FilterOption } from './useGenomesData.ts'

export interface Sorting {
  id: string
  desc: boolean
}

export type GenomesTableState = ReturnType<typeof useGenomesTableState>

// Owns the available-genomes table's filter/pagination/selection state. The
// single job of the wrapped setters below is to keep the "changing the result
// set returns to page 1" invariant in one place instead of scattered across
// call sites. The render already clamps the page index, so the resets are
// purely so you land on the top of the new result set.
//
// Switching group additionally resets the NCBI filter (its fields exist only on
// GenArk rows), clears the sort (the column may not exist in the new group's
// columns) and drops the selection, whose accessions belong to the previous
// group's dataset and would launch nothing. Leaving multiple-selection mode
// drops the selection too, since nothing would show it or act on it.
export function useGenomesTableState() {
  const [selected, setSelected] = useState(() => new Set<string>())
  const [sorting, setSorting] = useState<Sorting>()
  const [multipleSelection, setMultipleSelection] = useState(false)
  const [showAllColumns, setShowAllColumns] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [searchQuery, setSearchQuery] = useState('')
  const [clade, setClade] = useState('')
  const [showOnlyFavs, setShowOnlyFavs] = useState(false)
  const [allGroups, setAllGroups] = useState(false)
  const [filterOption, setFilterOption] = useState<FilterOption>('all')
  const [typeOption, setTypeOption] = useLocalStorage(
    'startScreen-genArkChoice',
    'ucsc',
  )

  return {
    selected,
    setSelected,
    sorting,
    multipleSelection,
    showAllColumns,
    setShowAllColumns,
    pageIndex,
    setPageIndex,
    pageSize,
    searchQuery,
    clade,
    showOnlyFavs,
    filterOption,
    typeOption,
    allGroups,

    // cross-group results have their own columns, so a sort naming a
    // group-only column has to go, as does a selection of rows about to be
    // replaced by hits from every group
    setAllGroups: (v: boolean) => {
      setAllGroups(v)
      setSorting(undefined)
      setSelected(new Set())
      setPageIndex(0)
    },
    setMultipleSelection: (v: boolean) => {
      setMultipleSelection(v)
      setSelected(new Set())
    },
    setPageSize: (size: number) => {
      setPageSize(size)
      setPageIndex(0)
    },
    setSearchQuery: (q: string) => {
      setSearchQuery(q)
      setPageIndex(0)
    },
    setClade: (c: string) => {
      setClade(c)
      setPageIndex(0)
    },
    setShowOnlyFavs: (v: boolean) => {
      setShowOnlyFavs(v)
      setPageIndex(0)
    },
    setFilterOption: (f: FilterOption) => {
      setFilterOption(f)
      setPageIndex(0)
    },
    setTypeOption: (t: string) => {
      setTypeOption(t)
      setFilterOption('all')
      setSorting(undefined)
      setSelected(new Set())
      setPageIndex(0)
    },
    toggleSort: (colId: string) => {
      setPageIndex(0)
      setSorting(prev =>
        prev?.id === colId
          ? prev.desc
            ? undefined
            : { id: colId, desc: true }
          : { id: colId, desc: false },
      )
    },
  }
}
