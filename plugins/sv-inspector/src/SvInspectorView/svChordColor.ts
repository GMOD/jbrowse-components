import { colord } from '@jbrowse/core/util/colord'
import { getSvTypeColor, getVariantSvType } from '@jbrowse/plugin-variants'

import type { Feature } from '@jbrowse/core/util'

/**
 * Chords overlap heavily — a whole-genome callset draws hundreds through the
 * middle of one circle — so they are drawn translucent and read by how they
 * pile up. Higher than the 0.32 the single-color scheme used: a hue has to
 * survive being laid over other hues, where one orange only had to survive
 * itself.
 */
const CHORD_ALPHA = 0.45

// keyed by SV type rather than by feature: there are a handful of types in any
// callset and thousands of chords, and `Chord` re-evaluates the color slot on
// every render (hover included)
const alphaColors = new Map<string, string>()

export function chordColorForType(type: string) {
  let color = alphaColors.get(type)
  if (color === undefined) {
    color = colord(getSvTypeColor(type)).alpha(CHORD_ALPHA).toRgbString()
    alphaColors.set(type, color)
  }
  return color
}

/**
 * The color a chord is drawn in: the variants plugin's SV-type color at chord
 * alpha, so a translocation in the circle and the same record in a variant
 * track are the same color. Registered as the `svChordColor` jexl function and
 * read from the chord display's `strokeColor` slot.
 */
export function svChordColor(feature: Feature) {
  return chordColorForType(getVariantSvType(feature))
}
