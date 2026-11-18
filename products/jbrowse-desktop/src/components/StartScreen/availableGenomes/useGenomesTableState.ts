import { useState } from 'react'

import { useLocalStorage } from '@jbrowse/core/util/hooks'

import { isSearching } from './useGenomesData.ts'

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
// A query searches every group, so the group selector only chooses what to
// browse: picking one clears the query, resets the NCBI filter (its fields
// exist only on GenArk rows), the sort (the column may not exist in the new
// group's columns) and the selection. Leaving multiple-selection mode drops the
// selection too, since nothing would show it or act on it.
//
// hasSearched latches on the first query, so the cross-group index is fetched
// only once someone searches, and stays loaded to resolve a selection after the
// query is cleared.
export function useGenomesTableState() {
  const [selected, setSelected] = useState(() => new Set<string>())
  const [sorting, setSorting] = useState<Sorting>()
  const [multipleSelection, setMultipleSelection] = useState(false)
  const [showAllColumns, setShowAllColumns] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [searchQuery, setSearchQuery] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
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
    hasSearched,
    filterOption,
    typeOption,

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
      if (isSearching(q)) {
        setHasSearched(true)
      }
      setPageIndex(0)
    },
    setFilterOption: (f: FilterOption) => {
      setFilterOption(f)
      setPageIndex(0)
    },
    setTypeOption: (t: string) => {
      setTypeOption(t)
      setSearchQuery('')
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
