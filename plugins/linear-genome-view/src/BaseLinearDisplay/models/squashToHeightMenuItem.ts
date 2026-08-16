import { toggleItem } from '@jbrowse/core/ui/menuItems'

import type { MenuItem } from '@jbrowse/core/ui'

/**
 * The "Fit to display height" row for the triangular contact-matrix displays
 * (HiC, LD), which share `computeTriangleYScalar` for the squash it toggles.
 * One helper so the label and the explanation of what a resize does can't drift
 * between the two — they had already drifted to two wordings of the same
 * sentence.
 *
 * Named for the squash rather than the fit because the row displays' unrelated
 * `setFitToHeight()` means "write the `rowHeight` fit sentinel"; a triangle has
 * no rows to fit. Same user-facing idea, so the label still reads "Fit to
 * display height" — see agent-docs/reference/ROW_HEIGHT_AND_FIT.
 */
export function squashToHeightCheckboxItem(self: {
  squashToHeight: boolean
  setSquashToHeight: (arg: boolean) => void
}): MenuItem {
  return toggleItem(
    'Fit to display height',
    self.squashToHeight,
    self.setSquashToHeight,
    {
      helpText:
        'Squash the triangle vertically to fill the display height instead of drawing square bins at its natural half-width height.',
    },
  )
}
