import { alpha } from '@jbrowse/core/ui/palette'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { ToggleButton, ToggleButtonGroup } from '@mui/material'
import { observer } from 'mobx-react'

import type { HierarchicalTrackSelectorModel, TrackList } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    margin: theme.spacing(1.5, 1, 0, 2),
  },
  button: {
    padding: theme.spacing(0.25, 1.25),
    textTransform: 'none',
    '&.Mui-selected, &.Mui-selected:hover': {
      backgroundColor: alpha(theme.palette.primary.main, 0.14),
      color: theme.palette.primary.main,
      fontWeight: 600,
    },
  },
}))

// the drawer column and the grid it shares with the views, as Drawer.tsx
// clamps against; absent in a modal
function measureDrawer(from: HTMLElement) {
  const column = from.closest<HTMLElement>('[data-drawer-column]')
  const grid = column?.parentElement
  return column && grid
    ? { width: column.offsetWidth, availableWidth: grid.clientWidth }
    : undefined
}

function isTrackList(value: unknown): value is TrackList {
  return value === 'all' || value === 'favorites' || value === 'recent'
}

function withCount(label: string, count: number) {
  return count ? `${label} ${count}` : label
}

const TrackSelectorToggles = observer(function TrackSelectorToggles({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.row}>
      <ToggleButtonGroup
        exclusive
        size="small"
        aria-label="Which tracks"
        value={model.trackList}
        onChange={(_event, value) => {
          if (isTrackList(value)) {
            model.setTrackList(value)
          }
        }}
      >
        <ToggleButton value="all" className={classes.button}>
          All
        </ToggleButton>
        <ToggleButton
          value="favorites"
          className={classes.button}
          data-testid="list-favorites"
        >
          {withCount('Favorites', model.favoriteTracks.length)}
        </ToggleButton>
        <ToggleButton
          value="recent"
          className={classes.button}
          data-testid="list-recent"
        >
          {withCount('Recent', model.recentlyUsedTracks.length)}
        </ToggleButton>
      </ToggleButtonGroup>
      <ToggleButtonGroup
        exclusive
        size="small"
        aria-label="Show tracks as"
        value={model.showTable ? 'table' : 'tree'}
        onChange={(event, value) => {
          if (value === 'table') {
            model.openTable(measureDrawer(event.currentTarget))
          } else if (value === 'tree') {
            model.closeTable()
          }
        }}
      >
        <ToggleButton
          value="tree"
          className={classes.button}
          data-testid="show-as-tree"
        >
          Tree
        </ToggleButton>
        <ToggleButton
          value="table"
          className={classes.button}
          data-testid="show-as-table"
        >
          Table
        </ToggleButton>
      </ToggleButtonGroup>
    </div>
  )
})

export default TrackSelectorToggles
