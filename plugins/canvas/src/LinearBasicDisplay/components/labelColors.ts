import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

/**
 * What each kind of feature label is painted in. A pure function of the theme —
 * no label has ever had a color of its own — so it is resolved here rather than
 * baked in the worker: the worker would need the palette in its RPC payload,
 * which makes it a cache key, which makes a light/dark toggle refetch every
 * region (`colorClasses.ts` says the same thing for the GPU lanes).
 *
 * It also fixes the SVG export, which resolves the *export* theme's palette:
 * baked labels came out in the session's colors on a figure rendered for the
 * other one.
 */
export interface LabelColors {
  name: string
  description: string
  more: string
  subfeature: string
  // An overlay subfeature label sits on a light backing rect, so it stays dark
  // whatever the page theme is; an inline one reads against the track.
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
