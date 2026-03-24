import { observer } from 'mobx-react'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import DeleteIcon from '@mui/icons-material/Delete'
import MoreVertIcon from '@mui/icons-material/MoreVert'

import type { GraphGenomeViewModel } from '../model.ts'

const qualityLabels = ['Lowest', 'Low', 'Medium', 'High', 'Highest'] as const

const SettingsMenu = observer(function SettingsMenu({
  model,
}: {
  model: GraphGenomeViewModel
}) {
  return (
    <CascadingMenuButton
      size="small"
      menuItems={[
        { type: 'subHeader', label: 'Layout quality' },
        ...qualityLabels.map((label, i) => ({
          type: 'radio' as const,
          label,
          checked: model.layoutQuality === i,
          onClick: () => {
            model.setLayoutQuality(i)
            model.recomputeLayout()
          },
        })),
        { type: 'divider' as const },
        {
          label: 'Close graph',
          icon: DeleteIcon,
          onClick: () => model.clearGraph(),
        },
      ]}
    >
      <MoreVertIcon />
    </CascadingMenuButton>
  )
})

export default SettingsMenu
