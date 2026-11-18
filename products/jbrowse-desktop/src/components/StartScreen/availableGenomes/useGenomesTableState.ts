import { useState } from 'react'

import { useLocalStorage } from '@jbrowse/core/util/hooks'

import { isSearching } from './useGenomesData.ts'

import type { FilterOption } from './useGenomesData.ts'

export type GenomesTableState = ReturnType<typeof useGenomesTableState>

// Owns the available-genomes table's filter and selection state.
//
// A query searches every group, so the group selector only chooses what to
// browse: picking one clears the query, resets the NCBI filter (its fields
// exist only on GenArk rows) and the selection. Leaving multiple-selection
// mode drops the selection too, since nothing would show it or act on it.
//
// hasSearched latches on the first query, so the cross-group index is fetched
// only once someone searches, and stays loaded to resolve a selection after the
// query is cleared.
export function useGenomesTableState() {
  const [selected, setSelected] = useState(() => new Set<string>())
  const [multipleSelection, setMultipleSelection] = useState(false)
  const [showAllColumns, setShowAllColumns] = useState(false)
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
    multipleSelection,
    showAllColumns,
    setShowAllColumns,
    searchQuery,
    hasSearched,
    filterOption,
    setFilterOption,
    typeOption,

    setMultipleSelection: (v: boolean) => {
      setMultipleSelection(v)
      setSelected(new Set())
    },
    setSearchQuery: (q: string) => {
      setSearchQuery(q)
      if (isSearching(q)) {
        setHasSearched(true)
      }
    },
    setTypeOption: (t: string) => {
      setTypeOption(t)
      setSearchQuery('')
      setFilterOption('all')
      setSelected(new Set())
    },
  }
}
