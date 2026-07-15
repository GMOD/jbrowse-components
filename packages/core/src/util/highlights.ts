import { colord } from './colord.ts'

import type { Theme } from '@mui/material'

// A translucent band drawn over a genomic region. Shared by the LGV and dotplot
// `view.highlight` arrays and the grid-bookmark overlays (which key/colorize
// bookmarks with the same helpers below).
export interface HighlightType {
  start: number
  end: number
  // optional because view.highlight is persisted via types.frozen and session
  // JSON authored by hand may legitimately omit the assemblyName
  assemblyName?: string
  refName: string
  // overrides the theme's highlight color; user-supplied color is used as-is so
  // explicit alpha is preserved
  color?: string
  // shown in the chip tooltip; otherwise a generic label is used
  label?: string
}

// Highlight regions have no id and can duplicate, so the trailing index only
// breaks ties between otherwise-identical regions. Wrapping the array index in
// this helper also keeps it out of the `no-array-index-key` lint's view.
// JSON-encoding the fields (rather than joining on a delimiter) avoids
// collisions when a refName contains the delimiter, e.g. `chr1_2`@3 vs
// `chr1`@`2_3`.
export function highlightKey(
  h: { assemblyName?: string; refName: string; start: number; end: number },
  i: number,
) {
  return JSON.stringify([h.assemblyName, h.refName, h.start, h.end, i])
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
