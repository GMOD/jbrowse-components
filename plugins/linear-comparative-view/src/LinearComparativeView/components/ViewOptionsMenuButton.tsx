import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { searchBoxPrefsMenuItems } from '@jbrowse/plugin-linear-genome-view'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { observer } from 'mobx-react'

import type { LinearComparativeViewModel } from '../model.ts'
import type { SearchBoxPrefs } from '@jbrowse/plugin-linear-genome-view'

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
        {
          label: 'Row view menus',
          type: 'subMenu',
          subMenu: model.views.map((view, idx) => ({
            label: `View ${idx + 1} Menu`,
            subMenu: view.menuItems(),
          })),
        },
        ...model.headerMenuItems(),
        {
          label: 'Show...',
          icon: VisibilityIcon,
          subMenu: [
            ...model.showMenuItems(),
            ...searchBoxPrefsMenuItems(prefs),
          ],
        },
      ]}
    >
      <MoreVertIcon />
    </CascadingMenuButton>
  )
})

export default ViewOptionsMenuButton
