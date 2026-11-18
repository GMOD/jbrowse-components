import VirtualTable, {
  checkboxLeading,
  useTableSort,
} from '@jbrowse/core/ui/VirtualTable'
import { highlightPatterns } from '@jbrowse/core/util/searchText'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import NetworkErrorMessage from '../NetworkErrorMessage.tsx'
import GenomesTableToolbar from './GenomesTableToolbar.tsx'
import SkeletonLoader from './SkeletonLoader.tsx'
import { columnWidths, getColumnDefinitions } from './getColumnDefinitions.tsx'
import useCategories from './useCategories.ts'
import { ncbiFilterApplies } from './useGenomesData.ts'
import { useGenomesTableState } from './useGenomesTableState.ts'
import { useResultSet } from './useResultSet.ts'

import type { Fav, LaunchCallback } from '../types.ts'
import type { Entry } from './getColumnDefinitions.tsx'

const useStyles = makeStyles()(theme => ({
  panel: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
  },
  table: {
    flex: 1,
    minHeight: 0,
  },
  count: {
    marginTop: theme.spacing(1),
  },
}))

interface GenomeRow extends Entry {
  id: string
}

// what the counts are scoped to: the selected group while browsing, every
// group while searching
function countText(shown: number, scopeTotal: number, scopeLabel: string) {
  const scope = `${scopeTotal.toLocaleString()} ${scopeTotal === 1 ? 'genome' : 'genomes'} ${scopeLabel}`
  return shown === scopeTotal ? scope : `${shown.toLocaleString()} of ${scope}`
}

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

const GenomesDataTable = observer(function GenomesDataTable({
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
  const state = useGenomesTableState()
  const {
    typeOption,
    searchQuery,
    hasSearched,
    filterOption,
    selected,
    setSelected,
    multipleSelection,
    showAllColumns,
  } = state

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
    hasSearched,
    // The remembered choice is only applied where its fields exist, so a filter
    // whose menu item is not on screen cannot be silently emptying the table.
    filterOption: ncbiFilterApplies(activeTypeOption, searchQuery)
      ? filterOption
      : 'all',
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

  const rows: GenomeRow[] = results.rows.map(row => ({
    ...row,
    id: row.accession,
  }))
  const { sortedRows, sortProps } = useTableSort(rows, columns)

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
      />

      {loadError ? <NetworkErrorMessage error={loadError} /> : null}

      {loadError ? null : results.isLoading ? (
        <SkeletonLoader columnCount={columns.length} />
      ) : (
        <>
          <div className={classes.table}>
            <VirtualTable
              rows={sortedRows}
              columns={columns}
              widths={() => columnWidths}
              {...sortProps}
              resetKey={JSON.stringify([
                activeTypeOption,
                searchQuery,
                filterOption,
              ])}
              highlightPatterns={highlightPatterns(searchQuery)}
              isRowSelected={row => selected.has(row.id)}
              leading={
                multipleSelection
                  ? checkboxLeading<GenomeRow>({
                      selected,
                      onChange: setSelected,
                      label: row => `Select ${row.commonName} ${row.accession}`,
                      allLabel: 'Select all genomes shown',
                    })
                  : undefined
              }
              emptyMessage="No genomes match the current search and filters"
              testId="genomes-table"
            />
          </div>
          <Typography
            variant="body2"
            color="textSecondary"
            className={classes.count}
            role="status"
          >
            {countText(
              sortedRows.length,
              results.scopeTotal,
              results.scopeLabel,
            )}
          </Typography>
        </>
      )}
    </div>
  )
})

export default GenomesDataTable
