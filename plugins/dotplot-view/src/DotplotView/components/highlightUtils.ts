import { colord } from '@jbrowse/core/util/colord'

import type { Theme } from '@mui/material'

// User-supplied color is used as-is so explicit alpha is preserved; otherwise
// fall back to the theme highlight color at a standard alpha
export function getHighlightColor(highlight: { color?: string }, theme: Theme) {
  return highlight.color
    ? colord(highlight.color)
    : colord(theme.palette.highlight.main).alpha(0.35)
}
