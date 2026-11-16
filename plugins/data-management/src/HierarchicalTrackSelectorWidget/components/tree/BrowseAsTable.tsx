import { makeStyles } from '@jbrowse/core/util/tss-react'
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'

const useStyles = makeStyles()(theme => ({
  button: {
    alignSelf: 'flex-start',
    maxWidth: `calc(100% - ${theme.spacing(4)})`,
    margin: theme.spacing(-1.5, 2, 0.5),
    textTransform: 'none',
  },
  label: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}))

// The drawer column this button sits in, and the grid it shares with the
// views: the same pair Drawer.tsx's resize handle clamps against. Absent when
// the widget shows in a modal instead.
function measureDrawer(from: HTMLElement) {
  const column = from.closest<HTMLElement>('[data-drawer-column]')
  const grid = column?.parentElement
  return column && grid
    ? { width: column.offsetWidth, availableWidth: grid.clientWidth }
    : undefined
}

const BrowseAsTable = observer(function BrowseAsTable({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useStyles()
  const query = model.filterText.trim()
  return (
    <Button
      data-testid="browse-as-table"
      size="small"
      className={classes.button}
      startIcon={<TableChartOutlinedIcon />}
      autoFocus={model.returnedFromTable}
      onFocus={() => {
        model.clearReturnedFromTable()
      }}
      onClick={event => {
        model.openTable(measureDrawer(event.currentTarget))
      }}
    >
      <span className={classes.label}>
        {query ? `Search “${query}” in the table` : 'Browse as a table'}
      </span>
    </Button>
  )
})

export default BrowseAsTable
