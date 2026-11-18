import { CascadingMenuButton } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import Help from '@mui/icons-material/Help'
import MoreVert from '@mui/icons-material/MoreVert'
import { Button, IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import { MAX_GENOMES_PER_LAUNCH, TOO_MANY_GENOMES } from '../launchLimit.ts'
import CategorySelector from './CategorySelector.tsx'
import SearchField from './SearchField.tsx'
import { getTableMenuItems } from './getTableMenuItems.ts'
import { isSearching } from './useGenomesData.ts'

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

// The filter/action row above the table: multi-select launch, search, the group
// selector, the settings menu, and the about link. All of it reads and
// mutates the shared table state; the table body below only displays the
// resulting rows.
const GenomesTableToolbar = observer(function GenomesTableToolbar({
  state,
  activeTypeOption,
  categories,
  onLaunchSelected,
}: {
  state: GenomesTableState
  activeTypeOption: string
  categories?: Category[]
  onLaunchSelected: () => void
}) {
  const { classes } = useStyles()
  const {
    selected,
    multipleSelection,
    searchQuery,
    setSearchQuery,
    setTypeOption,
  } = state

  const tooMany = selected.size > MAX_GENOMES_PER_LAUNCH

  return (
    <div className={classes.span}>
      {multipleSelection ? (
        <Tooltip title={tooMany ? TOO_MANY_GENOMES : ''}>
          <span>
            <Button
              variant="contained"
              disabled={selected.size === 0 || tooMany}
              onClick={() => {
                onLaunchSelected()
              }}
            >
              {selected.size
                ? `Open ${selected.size.toLocaleString()} selected`
                : 'Open selected'}
            </Button>
          </span>
        </Tooltip>
      ) : null}

      <SearchField searchQuery={searchQuery} onChange={setSearchQuery} />

      {categories ? (
        <CategorySelector
          categories={categories}
          typeOption={activeTypeOption}
          searching={isSearching(searchQuery)}
          onChange={setTypeOption}
        />
      ) : null}
      <CascadingMenuButton
        aria-label="Table settings"
        menuItems={() =>
          getTableMenuItems({
            state,
            typeOption: activeTypeOption,
          })
        }
      >
        <MoreVert />
      </CascadingMenuButton>

      <IconButton
        size="small"
        title="About these genomes"
        onClick={() => {
          window.open('https://genomes.jbrowse.org/about', '_blank')
        }}
      >
        <Help />
      </IconButton>
    </div>
  )
})

export default GenomesTableToolbar
