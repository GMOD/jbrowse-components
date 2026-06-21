import { colord } from '@jbrowse/core/util/colord'

import type { Theme } from '@mui/material'

// Highlights have no id and can duplicate, so the trailing index only breaks
// ties between otherwise-identical regions.
export function highlightKey(
  h: { assemblyName?: string; refName: string; start: number; end: number },
  i: number,
) {
  return `${h.assemblyName}-${h.refName}-${h.start}-${h.end}-${i}`
}

// User-supplied color is used as-is so explicit alpha is preserved; otherwise
// fall back to the theme highlight color at a standard alpha
export function getHighlightColor(highlight: { color?: string }, theme: Theme) {
  return highlight.color
    ? colord(highlight.color)
    : colord(theme.palette.highlight.main).alpha(0.35)
}
