import { useRef, useState } from 'react'

import { CascadingMenuButton } from '@jbrowse/core/ui'
import { notEmpty, useLocalStorage } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import Help from '@mui/icons-material/Help'
import MoreVert from '@mui/icons-material/MoreVert'
import { Button, IconButton } from '@mui/material'

import NetworkErrorMessage from '../NetworkErrorMessage.tsx'
import CategorySelector from './CategorySelector.tsx'
import CladeSelector from './CladeSelector.tsx'
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
import useTaxonomyClades from './useTaxonomyClades.ts'

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
  const [clade, setClade] = useState('')
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
  const setCladeAndReset = (c: string) => {
    setClade(c)
    setPageIndex(0)
  }
  const setTypeOptionAndReset = (t: string) => {
    setTypeOption(t)
    setFilterOption('all')
    setPageIndex(0)
    // selection is keyed by row id; ids from the previous group don't exist in
    // the new dataset, so carrying them over would leave "Go" enabled with a
    // selection that launches nothing
    setSelected(new Set())
  }
  const tableRef = useRef<HTMLDivElement>(null)
  useSearchHighlight(tableRef, searchQuery)
  const { classes } = useStyles()
  const {
    categories,
    isLoading: categoriesLoading,
    error: categoriesError,
  } = useCategories()
  // A persisted group choice can reference a category that no longer exists in
  // categories.json; fall back to the first available category so we resolve a
  // real url instead of hanging forever on the loading skeleton.
  const categoryList = categories?.categories
  const activeCategory =
    categoryList?.find(c => c.key === typeOption) ?? categoryList?.[0]
  const activeTypeOption = activeCategory?.key ?? typeOption
  const url = activeCategory?.url
  const { clades } = useTaxonomyClades()
  const cladeTaxonIds = clade ? clades?.get(clade) : undefined

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
    cladeTaxonIds,
  })

  // categoriesError leaves url undefined, which would otherwise hang on an
  // infinite skeleton; surface it (and any genome-list error) instead.
  const loadError = categoriesError ?? error

  const columns = getColumnDefinitions({
    typeOption: activeTypeOption,
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

  // Clamp during render so shrinking the result set (e.g. removing favorites,
  // resetting the favorites list) can never leave us stranded on an empty page,
  // independent of which handlers remember to reset pageIndex.
  const pageCount = Math.max(1, Math.ceil(sortedData.length / pageSize))
  const currentPage = Math.min(pageIndex, pageCount - 1)
  const pageRows = sortedData.slice(
    currentPage * pageSize,
    currentPage * pageSize + pageSize,
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
          typeOption={activeTypeOption}
          categoriesLoading={categoriesLoading}
          categoriesError={categoriesError}
          onChange={setTypeOptionAndReset}
        />
        <CladeSelector
          clades={clades}
          clade={clade}
          onChange={setCladeAndReset}
        />
        <CascadingMenuButton
          menuItems={() =>
            getTableMenuItems({
              typeOption: activeTypeOption,
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
            pageIndex={currentPage}
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
