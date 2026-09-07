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
