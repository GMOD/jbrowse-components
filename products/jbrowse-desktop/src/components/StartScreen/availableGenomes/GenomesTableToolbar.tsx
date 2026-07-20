import { CascadingMenuButton } from '@jbrowse/core/ui'
import { notEmpty } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import Help from '@mui/icons-material/Help'
import MoreVert from '@mui/icons-material/MoreVert'
import { Button, IconButton } from '@mui/material'

import CategorySelector from './CategorySelector.tsx'
import CladeSelector from './CladeSelector.tsx'
import SearchField from './SearchField.tsx'
import { getTableMenuItems } from './getTableMenuItems.ts'

import type { Entry } from './getColumnDefinitions.tsx'
import type { Categories } from './useCategories.ts'
import type { GenomesTableState } from './useGenomesTableState.ts'
import type { Fav, LaunchCallback } from '../types.ts'

const useStyles = makeStyles()({
  span: {
    gap: 10,
    display: 'flex',
    marginBottom: 20,
    marginTop: 20,
  },
})

// The filter/action row above the table: multi-select launch, search, group
// and clade selectors, the settings menu, and the more-info button. All of it
// reads and mutates the shared table state; the table body below only displays
// the resulting rows.
export default function GenomesTableToolbar({
  state,
  activeTypeOption,
  allData,
  categories,
  categoriesLoading,
  categoriesError,
  clades,
  setFavorites,
  launch,
  onClose,
  onMoreInfo,
}: {
  state: GenomesTableState
  activeTypeOption: string
  allData: Entry[]
  categories?: Categories
  categoriesLoading: boolean
  categoriesError?: unknown
  clades?: Map<string, Set<number>>
  setFavorites: (arg: Fav[]) => void
  launch: LaunchCallback
  onClose: () => void
  onMoreInfo: () => void
}) {
  const { classes } = useStyles()
  const {
    selected,
    setSelected,
    multipleSelection,
    setMultipleSelection,
    showOnlyFavs,
    setShowOnlyFavs,
    showAllColumns,
    setShowAllColumns,
    filterOption,
    setFilterOption,
    searchQuery,
    setSearchQuery,
    clade,
    setClade,
    setTypeOption,
  } = state

  return (
    <div className={classes.span}>
      {multipleSelection ? (
        <Button
          variant="contained"
          disabled={selected.size === 0}
          onClick={() => {
            // resolve against allData (the full group) not the filtered rows,
            // so a selection built up across searches launches every entry
            const selectedRows = [...selected]
              .map(id => allData.find(row => row.id === id))
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

      <SearchField searchQuery={searchQuery} onChange={setSearchQuery} />

      <CategorySelector
        categories={categories}
        typeOption={activeTypeOption}
        categoriesLoading={categoriesLoading}
        categoriesError={categoriesError}
        onChange={setTypeOption}
      />
      <CladeSelector clades={clades} clade={clade} onChange={setClade} />
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
            setFilterOption,
            setFavorites,
          })
        }
      >
        <MoreVert />
      </CascadingMenuButton>

      <IconButton size="small" title="More information" onClick={onMoreInfo}>
        <Help />
      </IconButton>
    </div>
  )
}
