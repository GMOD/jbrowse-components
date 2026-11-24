import { alpha } from '@jbrowse/core/ui/palette'
import { getSession, isSessionWithDrawerWidgets } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import GridOnIcon from '@mui/icons-material/GridOn'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import { ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { HierarchicalTrackSelectorModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  row: {
    display: 'flex',
    gap: theme.spacing(0.5),
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

// the width the drawer and the views share
function measureDrawerRow(from: HTMLElement) {
  return from.closest<HTMLElement>('[data-drawer-column]')?.parentElement
    ?.clientWidth
}

const TreeTableToggle = observer(function TreeTableToggle({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  return (
    <div className={classes.row}>
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
      {model.showTable &&
      isSessionWithDrawerWidgets(session) &&
      session.drawerVisible ? (
        <Tooltip
          title={model.tableWide ? 'Show fewer columns' : 'Show every column'}
        >
          <ToggleButton
            value="wide"
            size="small"
            aria-label="Show every column"
            selected={model.tableWide}
            className={classes.button}
            data-testid="table-bump-out"
            onChange={event => {
              model.setTableWide(
                !model.tableWide,
                measureDrawerRow(event.currentTarget),
              )
            }}
          >
            {model.tableWide ? (
              <CloseFullscreenIcon fontSize="small" />
            ) : (
              <OpenInFullIcon fontSize="small" />
            )}
          </ToggleButton>
        </Tooltip>
      ) : null}
    </div>
  )
})

export default TreeTableToggle
