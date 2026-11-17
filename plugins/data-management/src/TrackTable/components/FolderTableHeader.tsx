import ClearableSearchField from '@jbrowse/core/ui/ClearableSearchField'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import ShoppingCart from '../../HierarchicalTrackSelectorWidget/components/ShoppingCart.tsx'

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
 * a dialog table's own filter box; the drawer's table shares the track
 * selector's header
 */
const FolderTableHeader = observer(function FolderTableHeader({
  model,
  table,
}: {
  model: HierarchicalTrackSelectorModel
  table: TrackTableModel
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
      <ShoppingCart model={model} />
    </div>
  )
})

export default FolderTableHeader
