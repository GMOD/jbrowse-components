import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

/**
 * The main thread resolves label colors from the theme rather than the worker
 * baking them: a palette in the RPC payload becomes a cache key, so a light/dark
 * toggle would refetch every region.
 */
export interface LabelColors {
  name: string
  description: string
  more: string
  subfeature: string
  // An overlay label sits on a light backing rect, so it stays dark in any theme.
  subfeatureOverlay: string
}

export function labelColors(palette: JBrowsePalette): LabelColors {
  return {
    name: palette.text.primary,
    description: palette.featureDescription,
    more: palette.text.secondary,
    subfeature: palette.text.primary,
    subfeatureOverlay: palette.common.black,
  }
}
