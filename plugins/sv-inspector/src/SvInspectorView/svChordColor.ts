import { SimpleFeature } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'
import {
  PREDEFINED_SV_TYPES,
  getVariantSvType,
  getVariantSvTypeColor,
  svTypeDisplayLabel,
} from '@jbrowse/plugin-variants'

import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'

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

function chordColorForType(type: string, feature: Feature) {
  let color = alphaColors.get(type)
  if (color === undefined) {
    color = colord(getVariantSvTypeColor(feature))
      .alpha(CHORD_ALPHA)
      .toRgbString()
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
  return chordColorForType(getVariantSvType(feature), feature)
}

export interface SvTypeTally {
  type: string
  label: string
  color: string
  count: number
}

const CANONICAL_ORDER = Object.fromEntries(
  PREDEFINED_SV_TYPES.map((t, i) => [t.type, i]),
)

/**
 * The SV classes present in a set of rows, with the color the chords draw them
 * in and how many there are — the circular half's legend, and the only count of
 * the callset the view shows. Built off the rows the sheet is currently
 * showing, so a filter narrows the tally the same way it narrows the chords.
 *
 * Records that are not structural variants at all (a plain SNV in a mixed VCF)
 * have no class and are left out rather than tallied under an empty label; they
 * draw as a chord to their own end, which is nothing at this scale.
 */
export function svTypeTallies(features: SimpleFeatureSerialized[]) {
  const counts = new Map<string, { count: number; feature: Feature }>()
  for (const data of features) {
    const feature = new SimpleFeature(data)
    const type = getVariantSvType(feature)
    if (!type) {
      continue
    }
    const entry = counts.get(type)
    if (entry) {
      entry.count++
    } else {
      counts.set(type, { count: 1, feature })
    }
  }
  return [...counts]
    .map(([type, { count, feature }]) => ({
      type,
      label: svTypeDisplayLabel(type),
      color: chordColorForType(type, feature),
      count,
    }))
    .sort(
      (a, b) =>
        (CANONICAL_ORDER[a.type] ?? Number.POSITIVE_INFINITY) -
          (CANONICAL_ORDER[b.type] ?? Number.POSITIVE_INFINITY) ||
        a.type.localeCompare(b.type),
    )
}
