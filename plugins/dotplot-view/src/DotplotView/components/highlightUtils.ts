import { getHighlightColor as coreGetHighlightColor } from '@jbrowse/core/util/highlights'

import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

// dotplot bands sit over a denser plot, so they default to a stronger alpha
// than the LGV bands (0.35 vs 0.2)
export function getHighlightColor(
  highlight: { color?: string },
  theme: { palette: Pick<JBrowsePalette, 'highlight'> },
) {
  return coreGetHighlightColor(highlight, theme, 0.35)
}
