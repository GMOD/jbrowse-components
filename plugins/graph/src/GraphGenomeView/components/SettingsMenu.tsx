import { useState } from 'react'

import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import DeleteIcon from '@mui/icons-material/Delete'
import SettingsIcon from '@mui/icons-material/Settings'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { observer } from 'mobx-react'

import GraphSettingsDialog from './GraphSettingsDialog.tsx'

import type { GraphGenomeViewModel } from '../model.ts'

const SettingsMenu = observer(function SettingsMenu({
  model,
}: {
  model: GraphGenomeViewModel
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <CascadingMenuButton
        size="small"
        menuItems={[
          {
            type: 'checkbox' as const,
            label: 'Linear layout',
            checked: model.linearLayout,
            onClick: () => {
              model.setLinearLayout(!model.linearLayout)
              void model.recomputeLayout()
            },
          },
          { type: 'divider' as const },
          {
            label: 'Settings',
            icon: SettingsIcon,
            onClick: () => {
              setSettingsOpen(true)
            },
          },
          { type: 'divider' as const },
          {
            label: 'Return to import form',
            icon: DeleteIcon,
            onClick: () => {
              model.clearGraph()
            },
          },
        ]}
      >
        <MoreVertIcon />
      </CascadingMenuButton>

      <GraphSettingsDialog
        model={model}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  )
})

export default SettingsMenu
