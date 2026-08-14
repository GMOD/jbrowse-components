import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import PaletteIcon from '@mui/icons-material/Palette'
import { observer } from 'mobx-react'

import { colorByMenuItems, colorByMenuTargetFor } from './colorByMenuItems.tsx'
import { colorByShortLabel } from './colorLegend.ts'

import type { TrackColorsModel } from './colorByMenuItems.tsx'

/**
 * #api
 * The palette button both comparative headers render. The menu it opens was
 * already shared (`colorByMenuItems` over the structural `TrackColorsModel`), and
 * what was left in each plugin was the same button around it — which had already
 * drifted: only the synteny one said what mode it was currently in.
 *
 * The two flags are the whole of the difference, and each is a fact about the
 * view rather than a preference, so the caller states it:
 *
 * - `pointBased` picks the point-based wording for the modes whose help text
 *   describes a ribbon (a dotplot's Default is black, synteny's is red).
 * - `showReference` is whether there is a shared reference to anchor on: 'reference'
 *   coloring only carries meaning across a stack of two or more levels, and
 *   degenerates to query/target below that — a two-genome dotplot never has one.
 */
const ColorBySelector = observer(function ColorBySelector({
  model,
  pointBased,
  showReference,
}: {
  model: TrackColorsModel
  pointBased: boolean
  showReference: boolean
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
        colorByMenuTargetFor(model, { pointBased, showReference }),
      )}
    >
      <PaletteIcon />
    </CascadingMenuButton>
  )
})

export default ColorBySelector
