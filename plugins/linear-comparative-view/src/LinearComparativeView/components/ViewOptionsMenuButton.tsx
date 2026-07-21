import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { observer } from 'mobx-react'

import type { LinearComparativeViewModel } from '../model.ts'
import type { SearchBoxPrefs } from './useSearchBoxPrefs.ts'

const ViewOptionsMenuButton = observer(function ViewOptionsMenuButton({
  model,
  prefs,
}: {
  model: LinearComparativeViewModel
  prefs: SearchBoxPrefs
}) {
  const { showSearchBoxes, setShowSearchBoxes, sideBySide, setSideBySide } =
    prefs
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
            {
              label: 'Show search boxes',
              type: 'checkbox' as const,
              checked: showSearchBoxes,
              onClick: () => {
                setShowSearchBoxes(!showSearchBoxes)
              },
            },
            {
              label: 'Search box orientation',
              subMenu: [
                {
                  label: 'Side-by-side',
                  type: 'radio' as const,
                  checked: sideBySide,
                  onClick: () => {
                    setSideBySide(true)
                  },
                },
                {
                  label: 'Vertical',
                  type: 'radio' as const,
                  checked: !sideBySide,
                  onClick: () => {
                    setSideBySide(false)
                  },
                },
              ],
            },
          ],
        },
      ]}
    >
      <MoreVertIcon />
    </CascadingMenuButton>
  )
})

export default ViewOptionsMenuButton
