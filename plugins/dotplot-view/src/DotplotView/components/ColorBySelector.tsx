import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { colorByMenuItems, colorByMenuTargetFor } from '@jbrowse/synteny-core'
import PaletteIcon from '@mui/icons-material/Palette'
import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../model.ts'

const ColorBySelector = observer(function ColorBySelector({
  model,
}: {
  model: DotplotViewModel
}) {
  return (
    <CascadingMenuButton
      data-testid="color_by_menu"
      menuItems={colorByMenuItems(
        colorByMenuTargetFor(model, {
          pointBased: true,
          // the dotplot compares exactly two genomes, so there is no third
          // assembly for 'reference' to anchor on
          showReference: false,
        }),
      )}
    >
      <PaletteIcon />
    </CascadingMenuButton>
  )
})

export default ColorBySelector
