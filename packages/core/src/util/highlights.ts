import { colord } from './colord.ts'

import type { Theme } from '@mui/material'

// Highlight regions have no id and can duplicate, so the trailing index only
// breaks ties between otherwise-identical regions. Wrapping the array index in
// this helper also keeps it out of the `no-array-index-key` lint's view.
export function highlightKey(
  h: { assemblyName?: string; refName: string; start: number; end: number },
  i: number,
) {
  return `${h.assemblyName}-${h.refName}-${h.start}-${h.end}-${i}`
}

// User-supplied color is used as-is so explicit alpha is preserved; otherwise
// fall back to the theme highlight color at the given alpha. Shared by the LGV
// and dotplot highlight bands (which differ only in their default alpha).
export function getHighlightColor(
  highlight: { color?: string },
  theme: Theme,
  alpha = 0.2,
) {
  return highlight.color
    ? colord(highlight.color)
    : colord(theme.palette.highlight.main).alpha(alpha)
}
