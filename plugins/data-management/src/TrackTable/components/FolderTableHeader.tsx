import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import ClearableSearchField from '@jbrowse/core/ui/ClearableSearchField'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import MoreVert from '@mui/icons-material/MoreVert'
import { observer } from 'mobx-react'

import ShoppingCart from '../../HierarchicalTrackSelectorWidget/components/ShoppingCart.tsx'
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
 * a dialog table's own filter box and menu; the drawer's table shares the
 * track selector's header
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
      <CascadingMenuButton
        tooltip="Table options"
        menuItems={() => tableMenuItems(table, shown)}
      >
        <MoreVert />
      </CascadingMenuButton>
      <ShoppingCart model={model} />
    </div>
  )
})

export default FolderTableHeader
