import ClearableSearchField from '@jbrowse/core/ui/ClearableSearchField'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import ShoppingCart from '../../HierarchicalTrackSelectorWidget/components/ShoppingCart.tsx'
import TableMenuButton from './TableMenuButton.tsx'
import { tableMenuItems } from './tableLayout.ts'

import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { TrackTableModel } from '../trackTableModel.ts'

const useStyles = makeStyles()(theme => ({
  toolbar: {
    display: 'flex',
    alignItems: 'center',
  },
  searchBox: {
    flexGrow: 1,
    margin: theme.spacing(1, 1, 1, 1.5),
  },
}))

/**
 * a dialog table's own filter box and table menu; the drawer's table shares
 * the track selector's header
 */
const FolderTableHeader = observer(function FolderTableHeader({
  model,
  table,
  shown,
}: {
  model: HierarchicalTrackSelectorModel
  table: TrackTableModel
  shown: string[]
}) {
  const { classes } = useStyles()
  const { matchCounts } = table
  return (
    <div className={classes.toolbar}>
      <ClearableSearchField
        className={classes.searchBox}
        label="Filter tracks"
        value={table.filterText}
        status={
          matchCounts
            ? `${matchCounts.matched} of ${matchCounts.total}`
            : undefined
        }
        onChange={value => {
          table.setFilterText(value)
        }}
      />
      <TableMenuButton menuItems={() => tableMenuItems(table, shown)} />
      <ShoppingCart model={model} />
    </div>
  )
})

export default FolderTableHeader
