import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import { observer } from 'mobx-react'

import type { MenuItem } from '@jbrowse/core/ui'

const TableMenuButton = observer(function TableMenuButton({
  menuItems,
}: {
  menuItems: () => MenuItem[]
}) {
  return (
    <CascadingMenuButton
      data-testid="track-table-menu"
      tooltip="Table options"
      menuItems={menuItems}
    >
      <ViewColumnIcon />
    </CascadingMenuButton>
  )
})

export default TableMenuButton
