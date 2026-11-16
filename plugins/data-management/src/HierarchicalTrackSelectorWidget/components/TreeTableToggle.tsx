import { makeStyles } from '@jbrowse/core/util/tss-react'
import { ToggleButton, ToggleButtonGroup } from '@mui/material'
import { observer } from 'mobx-react'

import type { HierarchicalTrackSelectorModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  group: {
    alignSelf: 'flex-start',
    margin: theme.spacing(1, 1, 0, 2),
  },
  button: {
    padding: theme.spacing(0.25, 1.5),
    textTransform: 'none',
    '&.Mui-selected, &.Mui-selected:hover': {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
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

const TreeTableToggle = observer(function TreeTableToggle({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useStyles()
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      aria-label="Show tracks as"
      className={classes.group}
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
  )
})

export default TreeTableToggle
