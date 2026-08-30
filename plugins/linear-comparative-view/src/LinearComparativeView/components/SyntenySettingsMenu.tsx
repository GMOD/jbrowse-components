import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { SETTINGS_SURFACE_LABELS } from '@jbrowse/synteny-core'
import TuneIcon from '@mui/icons-material/Tune'
import { observer } from 'mobx-react'

import { syntenySettingsMenuItems } from './syntenySettingsMenuItems.ts'

import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'

/**
 * The button that opens the ribbon settings. What the rows are, and why they
 * are grouped the way they are, is `syntenySettingsMenuItems`.
 */
const SyntenySettingsMenu = observer(function SyntenySettingsMenu({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  return (
    <CascadingMenuButton
      tooltip={SETTINGS_SURFACE_LABELS.LinearSyntenyView}
      menuItems={() => syntenySettingsMenuItems(model)}
    >
      <TuneIcon />
    </CascadingMenuButton>
  )
})

export default SyntenySettingsMenu
