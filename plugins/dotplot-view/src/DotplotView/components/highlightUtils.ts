import {
  getHighlightColor as coreGetHighlightColor,
  highlightKey,
} from '@jbrowse/core/util/highlights'

import type { Theme } from '@mui/material'

export { highlightKey }

// dotplot bands sit over a denser plot, so they default to a stronger alpha
// than the LGV bands (0.35 vs 0.2)
export function getHighlightColor(highlight: { color?: string }, theme: Theme) {
  return coreGetHighlightColor(highlight, theme, 0.35)
}
