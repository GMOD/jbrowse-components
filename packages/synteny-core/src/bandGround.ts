import { alpha, getContrastText } from '@jbrowse/core/ui/palette'

/**
 * #api
 * The colour a comparative band is painted on, for every surface that has to
 * agree about it: the two backends' clear, the pre-blended indel wedges, every
 * mark, tick, label halo and outline (`getContrastText` of it), the legend
 * chips and the SVG export.
 *
 * Light in every theme. The ribbons are translucent colour that reads as tint
 * over a light ground and as murk over a dark one, so a dark theme's paper made
 * a whole-genome band nearly unreadable. The band is the one sheet in the app
 * that keeps its own ground.
 */
export const BAND_GROUND_COLOR = '#fff'

export function bandGroundColor() {
  return BAND_GROUND_COLOR
}

/**
 * #api
 * The inks a band draws in, off its own ground rather than the page theme, at
 * the light theme's weights: a dark theme's text and dividers are white and
 * vanish on the band.
 */
export function bandInk() {
  const ink = getContrastText(BAND_GROUND_COLOR)
  return {
    text: alpha(ink, 0.87),
    divider: alpha(ink, 0.12),
    gridline: alpha(ink, 0.12),
    stripe: alpha(ink, 0.04),
  }
}
