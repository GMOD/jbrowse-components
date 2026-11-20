import { alpha } from '@jbrowse/core/ui/palette'

import type { JBrowseStyleTheme } from '@jbrowse/core/ui/styleTheme'

/**
 * the hover and selection tints of a track's row, shared by the tree and the
 * table
 */
export function trackRowTints(theme: JBrowseStyleTheme) {
  return {
    hover: theme.palette.action.selected,
    // twice the dark hover tint (action.selected), four times the light one,
    // and still under white text in dark mode
    selected: alpha(theme.palette.accent, 0.32),
  }
}
