import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import {
  colorByMenuItems,
  colorByMenuTargetFor,
  colorByShortLabel,
} from '@jbrowse/synteny-core'
import PaletteIcon from '@mui/icons-material/Palette'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'

const ColorBySelector = observer(function ColorBySelector({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  const { uniformColorBy } = model
  return (
    <CascadingMenuButton
      data-testid="color_by_menu"
      tooltip={
        uniformColorBy
          ? `Color by: ${colorByShortLabel(uniformColorBy)}`
          : 'Color by: mixed'
      }
      menuItems={colorByMenuItems(
        colorByMenuTargetFor(model, {
          pointBased: false,
          // 'reference' coloring only carries meaning across a stack of >=2
          // levels; for a single-level (two-genome) view it degenerates to
          // query/target
          showReference: model.levels.length > 1,
        }),
      )}
    >
      <PaletteIcon />
    </CascadingMenuButton>
  )
})

export default ColorBySelector
