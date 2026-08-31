import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { searchBoxMenuItems } from '@jbrowse/plugin-linear-genome-view'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { observer } from 'mobx-react'

import type { LinearComparativeViewModel } from '../model.ts'
import type { SearchBoxPrefs } from '@jbrowse/plugin-linear-genome-view'

/**
 * The header's one menu. Its body is `headerMenuItems()`, so what a view offers
 * is stated once on the model rather than half here and half there — this used
 * to open with its own "Row view menus" submenu labelling the rows `View 1
 * Menu`, next to a `rowViewMenuItems` that labelled the same rows by assembly.
 * All that is left here is the search-box strip, whose state is React's rather
 * than the model's.
 */
const ViewOptionsMenuButton = observer(function ViewOptionsMenuButton({
  model,
  prefs,
}: {
  model: LinearComparativeViewModel
  prefs: SearchBoxPrefs
}) {
  return (
    <CascadingMenuButton
      tooltip="View options"
      menuItems={() => [
        ...model.headerMenuItems(),
        {
          label: 'Show...',
          icon: VisibilityIcon,
          subMenu: searchBoxMenuItems(prefs),
        },
      ]}
    >
      <MoreVertIcon />
    </CascadingMenuButton>
  )
})

export default ViewOptionsMenuButton
