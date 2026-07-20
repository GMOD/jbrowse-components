import { useRef, useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'

import NetworkErrorMessage from '../NetworkErrorMessage.tsx'
import GenomesTable from './GenomesTable.tsx'
import GenomesTableToolbar from './GenomesTableToolbar.tsx'
import MoreInfoDialog from './MoreInfoDialog.tsx'
import SkeletonLoader from './SkeletonLoader.tsx'
import TablePagination from './TablePagination.tsx'
import { getColumnDefinitions } from './getColumnDefinitions.tsx'
import { sortAndPaginate } from './sortAndPaginate.ts'
import useCategories from './useCategories.ts'
import { useGenomesData } from './useGenomesData.ts'
import { useGenomesTableState } from './useGenomesTableState.ts'
import { useSearchHighlight } from './useSearchHighlight.ts'
import useTaxonomyClades from './useTaxonomyClades.ts'

import type { Entry } from './getColumnDefinitions.tsx'
import type { Fav, LaunchCallback } from '../types.ts'

const useStyles = makeStyles()({
  panel: {
    minWidth: 1000,
    minHeight: 500,
    position: 'relative',
  },
})

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
  const { classes } = useStyles()
  const [moreInfoDialogOpen, setMoreInfoDialogOpen] = useState(false)
  const state = useGenomesTableState()
  const {
    typeOption,
    searchQuery,
    showOnlyFavs,
    filterOption,
    clade,
    sorting,
    toggleSort,
    selected,
    setSelected,
    multipleSelection,
    showAllColumns,
    pageIndex,
    setPageIndex,
    pageSize,
    setPageSize,
  } = state

  const tableRef = useRef<HTMLDivElement>(null)
  useSearchHighlight(tableRef, searchQuery)

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

  const {
    data,
    allData,
    error,
    isLoading: genomesLoading,
  } = useGenomesData({
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

  const { pageRows, currentPage, totalRows } = sortAndPaginate({
    data,
    columns,
    sorting,
    pageIndex,
    pageSize,
  })

  return (
    <div className={classes.panel}>
      <GenomesTableToolbar
        state={state}
        activeTypeOption={activeTypeOption}
        allData={allData}
        categories={categories}
        categoriesLoading={categoriesLoading}
        categoriesError={categoriesError}
        clades={clades}
        setFavorites={setFavorites}
        launch={launch}
        onClose={onClose}
        onMoreInfo={() => {
          setMoreInfoDialogOpen(true)
        }}
      />

      {loadError ? <NetworkErrorMessage error={loadError} /> : null}

      {loadError ? null : categoriesLoading || genomesLoading || !url ? (
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
            totalRows={totalRows}
            onPageChange={setPageIndex}
            onPageSizeChange={setPageSize}
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
