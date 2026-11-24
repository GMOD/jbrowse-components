import { alpha } from '@jbrowse/core/ui/palette'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import GridOnIcon from '@mui/icons-material/GridOn'
import { ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { HierarchicalTrackSelectorModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  group: {
    marginRight: theme.spacing(1),
  },
  button: {
    padding: theme.spacing(0.5, 0.75),
    '&.Mui-selected, &.Mui-selected:hover': {
      backgroundColor: alpha(theme.palette.primary.main, 0.14),
      color: theme.palette.primary.main,
    },
  },
}))

// absent in a modal, which has no drawer column
function measureDrawer(from: HTMLElement) {
  return from.closest<HTMLElement>('[data-drawer-column]')?.offsetWidth
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
      <Tooltip title="Show as tree">
        <ToggleButton
          value="tree"
          aria-label="Tree"
          className={classes.button}
          data-testid="show-as-tree"
        >
          <AccountTreeIcon fontSize="small" />
        </ToggleButton>
      </Tooltip>
      <Tooltip title="Show as table">
        <ToggleButton
          value="table"
          aria-label="Table"
          className={classes.button}
          data-testid="show-as-table"
        >
          <GridOnIcon fontSize="small" />
        </ToggleButton>
      </Tooltip>
    </ToggleButtonGroup>
  )
})

export default TreeTableToggle
