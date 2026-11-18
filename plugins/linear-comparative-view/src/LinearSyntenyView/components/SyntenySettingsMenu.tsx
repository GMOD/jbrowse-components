import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { searchBoxMenuItems } from '@jbrowse/plugin-linear-genome-view'
import { SETTINGS_SURFACE_LABELS } from '@jbrowse/synteny-core'
import TuneIcon from '@mui/icons-material/Tune'
import { observer } from 'mobx-react'

import { syntenySettingsMenuItems } from './syntenySettingsMenuItems.ts'

import type { LinearSyntenyViewModel } from '../model.ts'
import type { SearchBoxPrefs } from '@jbrowse/plugin-linear-genome-view'

/**
 * The button that opens the settings: the ribbon rows of
 * `syntenySettingsMenuItems`, then the "Show" submenu for the search boxes,
 * whose state is React's rather than the model's.
 */
const SyntenySettingsMenu = observer(function SyntenySettingsMenu({
  model,
  prefs,
}: {
  model: LinearSyntenyViewModel
  prefs: SearchBoxPrefs
}) {
  return (
    <CascadingMenuButton
      tooltip={SETTINGS_SURFACE_LABELS.LinearSyntenyView}
      menuItems={() => [
        ...syntenySettingsMenuItems(model),
        ...makeShowSubMenu(searchBoxMenuItems(prefs)),
      ]}
    >
      <TuneIcon />
    </CascadingMenuButton>
  )
})

export default SyntenySettingsMenu
