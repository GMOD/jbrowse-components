import { useRef, useState } from 'react'

import { CascadingMenuButton } from '@jbrowse/core/ui'
import { notEmpty, useLocalStorage } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import Help from '@mui/icons-material/Help'
import MoreVert from '@mui/icons-material/MoreVert'
import { Button, IconButton } from '@mui/material'

import NetworkErrorMessage from '../NetworkErrorMessage.tsx'
import CategorySelector from './CategorySelector.tsx'
import GenomesTable from './GenomesTable.tsx'
import MoreInfoDialog from './MoreInfoDialog.tsx'
import SearchField from './SearchField.tsx'
import SkeletonLoader from './SkeletonLoader.tsx'
import TablePagination from './TablePagination.tsx'
import { getColumnDefinitions } from './getColumnDefinitions.tsx'
import { getTableMenuItems } from './getTableMenuItems.ts'
import useCategories from './useCategories.ts'
import { useGenomesData } from './useGenomesData.ts'
import { useSearchHighlight } from './useSearchHighlight.ts'

import type { Entry, GenomeColumn } from './getColumnDefinitions.tsx'
import type { Fav, LaunchCallback } from '../types.ts'
import type { FilterOption } from './useGenomesData.ts'

const useStyles = makeStyles()({
  span: {
    gap: 10,
    display: 'flex',
    marginBottom: 20,
    marginTop: 20,
  },
  panel: {
    minWidth: 1000,
    minHeight: 500,
    position: 'relative',
  },
})

function defaultSort(a: Entry, b: Entry, col: GenomeColumn) {
  const aVal = `${a[col.id] ?? ''}`
  const bVal = `${b[col.id] ?? ''}`
  // numeric:true so columns containing numbers (e.g. taxonomy IDs, accessions)
  // order naturally (2 before 10) rather than lexically (10 before 2)
  return col.sortFn
    ? col.sortFn(a, b)
    : aVal.localeCompare(bVal, undefined, { numeric: true })
}

function rowToFav(row: Entry): Fav {
  return {
    id: row.id,
    shortName: row.name || row.ncbiAssemblyName || row.accession,
    commonName: row.commonName,
    description: row.description || row.commonName,
    jbrowseConfig: row.jbrowseConfig,
    jbrowseMinimalConfig: row.jbrowseMinimalConfig,
  }
}

export default function GenomesDataTable({
  favorites,
  setFavorites,
  onClose,
  launch,
}: {
  onClose: () => void
  favorites: Fav[]
  setFavorites: (arg: Fav[]) => void
  launch: LaunchCallback
}) {
  const [selected, setSelected] = useState(() => new Set<string>())
  const [showOnlyFavs, setShowOnlyFavs] = useState(false)
  const [filterOption, setFilterOption] = useState<FilterOption>('all')
  const [moreInfoDialogOpen, setMoreInfoDialogOpen] = useState(false)
  const [multipleSelection, setMultipleSelection] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [sorting, setSorting] = useState<{ id: string; desc: boolean }>()
  const [typeOption, setTypeOption] = useLocalStorage(
    'startScreen-genArkChoice',
    'ucsc',
  )
  const [showAllColumns, setShowAllColumns] = useState(false)

  // Reset to first page whenever the result set changes so we don't land on an empty page
  const setSearchQueryAndReset = (q: string) => {
    setSearchQuery(q)
    setPageIndex(0)
  }
  const setFilterOptionAndReset = (f: FilterOption) => {
    setFilterOption(f)
    setPageIndex(0)
  }
  const setTypeOptionAndReset = (t: string) => {
    setTypeOption(t)
    setFilterOption('all')
    setPageIndex(0)
  }
  const tableRef = useRef<HTMLDivElement>(null)
  useSearchHighlight(tableRef, searchQuery)
  const { classes } = useStyles()
  const {
    categories,
    isLoading: categoriesLoading,
    error: categoriesError,
  } = useCategories()
  const url = categories?.categories.find(f => f.key === typeOption)?.url

  const favs = new Set(favorites.map(f => f.id))
  const toggleFavorite = (row: Entry) => {
    if (favs.has(row.id)) {
      setFavorites(favorites.filter(fav => fav.id !== row.id))
    } else {
      setFavorites([...favorites, rowToFav(row)])
    }
  }

  const { data, error } = useGenomesData({
    searchQuery,
    filterOption,
    showOnlyFavs,
    favorites,
    url,
  })

  // categoriesError leaves url undefined, which would otherwise hang on an
  // infinite skeleton; surface it (and any genome-list error) instead.
  const loadError = categoriesError ?? error

  const columns = getColumnDefinitions({
    typeOption,
    favs,
    toggleFavorite,
    launch,
    onClose,
    showAllColumns,
  })

  const sortingCol =
    sorting !== undefined ? columns.find(c => c.id === sorting.id) : undefined
  const dir = sorting?.desc ? -1 : 1
  const sortedData = sortingCol
    ? [...data].sort((a, b) => dir * defaultSort(a, b, sortingCol))
    : data

  const pageRows = sortedData.slice(
    pageIndex * pageSize,
    pageIndex * pageSize + pageSize,
  )

  const toggleSort = (colId: string) => {
    setPageIndex(0)
    if (sorting?.id === colId) {
      if (sorting.desc) {
        setSorting(undefined)
      } else {
        setSorting({ id: colId, desc: true })
      }
    } else {
      setSorting({ id: colId, desc: false })
    }
  }

  return (
    <div className={classes.panel}>
      <div className={classes.span}>
        {multipleSelection ? (
          <Button
            variant="contained"
            disabled={selected.size === 0}
            onClick={() => {
              const selectedRows = [...selected]
                .map(id => data.find(row => row.id === id))
                .filter(notEmpty)
                .map(r => ({
                  jbrowseConfig: r.jbrowseConfig,
                  shortName: r.accession,
                }))

              launch(selectedRows)
              onClose()
            }}
          >
            Go
          </Button>
        ) : null}

        <SearchField
          searchQuery={searchQuery}
          onChange={setSearchQueryAndReset}
        />

        <CategorySelector
          categories={categories}
          typeOption={typeOption}
          categoriesLoading={categoriesLoading}
          categoriesError={categoriesError}
          onChange={setTypeOptionAndReset}
        />
        <CascadingMenuButton
          menuItems={() =>
            getTableMenuItems({
              typeOption,
              multipleSelection,
              showOnlyFavs,
              showAllColumns,
              filterOption,
              setMultipleSelection,
              setSelected,
              setShowOnlyFavs,
              setShowAllColumns,
              setPageIndex,
              setFilterOptionAndReset,
              setFavorites,
            })
          }
        >
          <MoreVert />
        </CascadingMenuButton>

        <IconButton
          size="small"
          title="More information"
          onClick={() => {
            setMoreInfoDialogOpen(true)
          }}
        >
          <Help />
        </IconButton>
      </div>

      {loadError ? <NetworkErrorMessage error={loadError} /> : null}

      {loadError ? null : categoriesLoading || (data.length === 0 && !url) ? (
        <SkeletonLoader />
      ) : (
        <div ref={tableRef}>
          <GenomesTable
            columns={columns}
            rows={pageRows}
            multipleSelection={multipleSelection}
            selected={selected}
            setSelected={setSelected}
            sorting={sorting}
            toggleSort={toggleSort}
          />

          <TablePagination
            pageIndex={pageIndex}
            pageSize={pageSize}
            totalRows={sortedData.length}
            onPageChange={setPageIndex}
            onPageSizeChange={size => {
              setPageSize(size)
              setPageIndex(0)
            }}
          />
        </div>
      )}
      {moreInfoDialogOpen ? (
        <MoreInfoDialog
          onClose={() => {
            setMoreInfoDialogOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}
