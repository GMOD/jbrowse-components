import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import { observer } from 'mobx-react'

import ShoppingCart from '../../HierarchicalTrackSelectorWidget/components/ShoppingCart.tsx'
import TrackFilterBox from './TrackFilterBox.tsx'
import { tableMenuItems } from './tableLayout.ts'

import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { TrackTableModel } from '../trackTableModel.ts'
import type { Ref } from 'react'

const useStyles = makeStyles()(theme => ({
  toolbar: {
    display: 'flex',
    alignItems: 'center',
  },
  searchBox: {
    flexGrow: 1,
    margin: theme.spacing(1, 1.5, 1, 1),
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
  filterBoxRef,
}: {
  model: HierarchicalTrackSelectorModel
  table: TrackTableModel
  shown: string[]
  filterBoxRef: Ref<HTMLInputElement>
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.toolbar}>
      <CascadingMenuButton
        data-testid="track-table-menu"
        tooltip="Table options"
        menuItems={() => tableMenuItems(model, table, shown)}
      >
        <ViewColumnIcon />
      </CascadingMenuButton>
      <ShoppingCart model={model} />
      <TrackFilterBox
        table={table}
        className={classes.searchBox}
        inputRef={filterBoxRef}
      />
    </div>
  )
})

export default FolderTableHeader
