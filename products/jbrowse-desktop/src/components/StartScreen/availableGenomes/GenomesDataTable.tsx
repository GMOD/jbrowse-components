import { useRef, useState } from 'react'

import { ActionLink } from '@jbrowse/core/ui'
import ConfirmDialog from '@jbrowse/core/ui/ConfirmDialog'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { DialogContentText } from '@mui/material'

import NetworkErrorMessage from '../NetworkErrorMessage.tsx'
import defaultFavs from '../defaultFavs.ts'
import GenomesTable from './GenomesTable.tsx'
import GenomesTableToolbar from './GenomesTableToolbar.tsx'
import MoreInfoDialog from './MoreInfoDialog.tsx'
import SkeletonLoader from './SkeletonLoader.tsx'
import TablePagination from './TablePagination.tsx'
import { getColumnDefinitions } from './getColumnDefinitions.tsx'
import { sortAndPaginate } from './sortAndPaginate.ts'
import useCategories from './useCategories.ts'
import { ncbiFilterApplies } from './useGenomesData.ts'
import { useGenomesTableState } from './useGenomesTableState.ts'
import { useResultSet } from './useResultSet.ts'
import { useSearchHighlight } from './useSearchHighlight.ts'

import type { Fav, LaunchCallback } from '../types.ts'
import type { Entry } from './getColumnDefinitions.tsx'

const useStyles = makeStyles()({
  panel: {
    minWidth: 1000,
    minHeight: 500,
    position: 'relative',
  },
})

function rowToFav(row: Entry): Fav {
  return {
    id: row.accession,
    shortName: row.name ?? row.ncbiAssemblyName ?? row.accession,
    commonName: row.commonName,
    description: row.description ?? row.commonName,
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
  const [dialog, setDialog] = useState<'moreInfo' | 'resetFavorites'>()
  const state = useGenomesTableState()
  const {
    typeOption,
    searchQuery,
    showOnlyFavs,
    filterOption,
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
    allGroups,
    setAllGroups,
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
  const activeCategory =
    categories?.find(c => c.key === typeOption) ?? categories?.[0]
  const activeTypeOption = activeCategory?.key ?? typeOption
  const url = activeCategory?.url

  const favs = new Set(favorites.map(f => f.id))
  const toggleFavorite = (row: Entry) => {
    if (favs.has(row.accession)) {
      setFavorites(favorites.filter(fav => fav.id !== row.accession))
    } else {
      setFavorites([...favorites, rowToFav(row)])
    }
  }

  const results = useResultSet({
    url,
    categoriesLoading,
    searchQuery,
    // The remembered choice is only applied where its fields exist, so a filter
    // whose menu item is not on screen cannot be silently emptying the table.
    filterOption: ncbiFilterApplies(activeTypeOption, allGroups)
      ? filterOption
      : 'all',
    showOnlyFavs,
    favoriteIds: favs,
    allGroups,
  })

  // categoriesError leaves url undefined, which would otherwise hang on an
  // infinite skeleton; surface it (and any row-fetch error) instead.
  const loadError = categoriesError ?? results.error

  // the search index labels a row with its category key, using 'uncategorized'
  // for the groups categories.json does not list separately
  const groupTitles = new Map(categories?.map(c => [c.key, c.title]))
  groupTitles.set('uncategorized', 'Other')

  const columns = getColumnDefinitions({
    typeOption: activeTypeOption,
    favs,
    toggleFavorite,
    launch,
    onClose,
    showAllColumns,
    groupTitles: results.isGlobal ? groupTitles : undefined,
  })

  const { pageRows, currentPage, totalRows } = sortAndPaginate({
    data: results.rows,
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
        categories={categories}
        onLaunchSelected={() => {
          launch(
            results.resolveSelection(selected).map(row => row.jbrowseConfig),
          )
          onClose()
        }}
        onResetFavorites={() => {
          setDialog('resetFavorites')
        }}
        onMoreInfo={() => {
          setDialog('moreInfo')
        }}
      />

      {loadError ? <NetworkErrorMessage error={loadError} /> : null}

      {loadError ? null : results.isLoading ? (
        <SkeletonLoader columnCount={columns.length} />
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
            emptyMessage={
              // offer the wider search exactly where it runs out, since the
              // selected group is 1 of 19 and nothing else says so
              searchQuery.trim() && !results.isGlobal ? (
                <>
                  No matches in {activeCategory?.title ?? 'this group'} —{' '}
                  <ActionLink
                    onClick={() => {
                      setAllGroups(true)
                    }}
                  >
                    search all groups
                  </ActionLink>
                </>
              ) : (
                'No genomes match the current search and filters'
              )
            }
          />

          <TablePagination
            pageIndex={currentPage}
            pageSize={pageSize}
            totalRows={totalRows}
            scopeTotal={results.scopeTotal}
            scopeLabel={results.scopeLabel}
            onPageChange={setPageIndex}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}
      {dialog === 'moreInfo' ? (
        <MoreInfoDialog
          onClose={() => {
            setDialog(undefined)
          }}
        />
      ) : null}
      {dialog === 'resetFavorites' ? (
        <ConfirmDialog
          open
          title="Reset favorites list to defaults?"
          onSubmit={() => {
            setFavorites(defaultFavs)
            setDialog(undefined)
          }}
          onCancel={() => {
            setDialog(undefined)
          }}
        >
          <DialogContentText>
            Replaces your list of {favorites.length} with the three JBrowse
            defaults (human hs1, hg38 and hg19). This cannot be undone.
          </DialogContentText>
        </ConfirmDialog>
      ) : null}
    </div>
  )
}
