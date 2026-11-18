import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../model.ts'

/**
 * The header's ⋮ menu: `headerMenuItems()`, what acts on the picture now.
 */
const ViewOptionsMenuButton = observer(function ViewOptionsMenuButton({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  return (
    <CascadingMenuButton
      tooltip="Zoom and layout options"
      menuItems={() => model.headerMenuItems()}
    >
      <MoreVertIcon />
    </CascadingMenuButton>
  )
})

export default ViewOptionsMenuButton
