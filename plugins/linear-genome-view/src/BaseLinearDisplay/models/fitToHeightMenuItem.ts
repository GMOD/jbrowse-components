import { checkboxItem } from '@jbrowse/core/ui'

import type { MenuItem } from '@jbrowse/core/ui'

/**
 * The "Fit to display height" row for the triangular contact-matrix displays
 * (HiC, LD), which share `computeTriangleYScalar` for the squash it toggles.
 * One helper so the label and the explanation of what a resize does can't drift
 * between the two — they had already drifted to two wordings of the same
 * sentence.
 */
export function fitToHeightCheckboxItem(self: {
  fitToHeight: boolean
  setFitToHeight: (arg: boolean) => void
}): MenuItem {
  return checkboxItem(
    'Fit to display height',
    self.fitToHeight,
    () => {
      self.setFitToHeight(!self.fitToHeight)
    },
    {
      helpText:
        'Squash the triangle vertically to fill the display height instead of drawing square bins at its natural half-width height.',
    },
  )
}
