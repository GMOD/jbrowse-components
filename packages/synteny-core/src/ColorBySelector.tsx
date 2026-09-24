import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import PaletteIcon from '@mui/icons-material/Palette'
import { observer } from 'mobx-react'

import { colorByMenuItems } from './colorByMenuItems.tsx'
import { colorByMenuTargetFor } from './colorByMenuTarget.ts'
import { colorByShortLabel } from './colorLegend.ts'

import type { TrackColorsModel } from './colorByMenuTarget.ts'

/**
 * #api
 * The palette button both comparative headers render, over the view's
 * `TrackColorsMixin`: what the view draws and whether it has a reference to
 * anchor on are the view's own hooks, so the button takes nothing else.
 */
const ColorBySelector = observer(function ColorBySelector({
  model,
}: {
  model: TrackColorsModel
}) {
  return (
    <CascadingMenuButton
      data-testid="color_by_menu"
      tooltip={`Color by: ${colorByShortLabel(model.colorByField)}`}
      menuItems={colorByMenuItems(colorByMenuTargetFor(model))}
    >
      <PaletteIcon />
    </CascadingMenuButton>
  )
})

export default ColorBySelector
