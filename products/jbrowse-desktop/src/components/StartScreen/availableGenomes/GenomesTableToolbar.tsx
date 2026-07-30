import { CascadingMenuButton } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import Help from '@mui/icons-material/Help'
import MoreVert from '@mui/icons-material/MoreVert'
import { Button, IconButton } from '@mui/material'

import CategorySelector from './CategorySelector.tsx'
import CladeSelector from './CladeSelector.tsx'
import SearchField from './SearchField.tsx'
import { getTableMenuItems } from './getTableMenuItems.ts'

import type { Category } from './useCategories.ts'
import type { GenomesTableState } from './useGenomesTableState.ts'

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
  categories,
  clades,
  onLaunchSelected,
  onResetFavorites,
  onMoreInfo,
}: {
  state: GenomesTableState
  activeTypeOption: string
  categories?: Category[]
  clades?: Map<string, Set<number>>
  onLaunchSelected: () => void
  onResetFavorites: () => void
  onMoreInfo: () => void
}) {
  const { classes } = useStyles()
  const {
    selected,
    multipleSelection,
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
            onLaunchSelected()
          }}
        >
          {selected.size ? `Open ${selected.size} selected` : 'Open selected'}
        </Button>
      ) : null}

      <SearchField searchQuery={searchQuery} onChange={setSearchQuery} />

      {categories ? (
        <CategorySelector
          categories={categories}
          typeOption={activeTypeOption}
          onChange={setTypeOption}
        />
      ) : null}
      <CladeSelector clades={clades} clade={clade} onChange={setClade} />
      <CascadingMenuButton
        menuItems={() =>
          getTableMenuItems({
            state,
            typeOption: activeTypeOption,
            onResetFavorites,
          })
        }
      >
        <MoreVert />
      </CascadingMenuButton>

      <IconButton
        size="small"
        title="More information"
        onClick={() => {
          onMoreInfo()
        }}
      >
        <Help />
      </IconButton>
    </div>
  )
}
