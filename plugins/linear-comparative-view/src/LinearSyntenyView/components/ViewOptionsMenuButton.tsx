import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { searchBoxMenuItems } from '@jbrowse/plugin-linear-genome-view'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../model.ts'
import type { SearchBoxPrefs } from '@jbrowse/plugin-linear-genome-view'

/**
 * The header's one menu, `headerMenuItems()` plus the search-box submenu, whose
 * state is React's rather than the model's.
 */
const ViewOptionsMenuButton = observer(function ViewOptionsMenuButton({
  model,
  prefs,
}: {
  model: LinearSyntenyViewModel
  prefs: SearchBoxPrefs
}) {
  return (
    <CascadingMenuButton
      tooltip="View options"
      menuItems={() =>
        model.headerMenuItems(makeShowSubMenu(searchBoxMenuItems(prefs)))
      }
    >
      <MoreVertIcon />
    </CascadingMenuButton>
  )
})

export default ViewOptionsMenuButton
