import { featureDefaultColor, utrDefaultColor } from '@jbrowse/core/ui/palette'

// What the `color`/`utrColor` slots resolve to when unset and the feature
// carries no BED color of its own. Pure fallbacks, never compared against a
// stored value. They live in core because the multi-sample variant display's
// lane paints an uncolored record with the same goldenrod.
export const FEATURE_DEFAULT_COLOR = featureDefaultColor
export const UTR_DEFAULT_COLOR = utrDefaultColor

// What **Color by... → Strand** writes into the `color` slot. `colorByMode`
// reads it back by string identity, so every writer of this expression has to
// change with it rather than growing a list of accepted spellings. It uses
// `feature.strand`, the short form the docs teach, so a user who types that by
// hand gets the menu radio to agree with the painted track.
export const STRAND_COLOR_JEXL =
  "jexl:feature.strand==1?'tomato':feature.strand==-1?'cornflowerblue':'goldenrod'"

// **Color by attribute**. The `colorByAttribute` getter reads the attribute
// name back out of the stored slot, and the generic return type lets a caller
// outside this package pin its own copy against this one at compile time.
//
// Keeps `get(feature,'…')` where STRAND_COLOR_JEXL drops it, because the
// attribute name is user-supplied and `feature.<name>` is legal jexl only for a
// bare identifier.
export function attributeColorJexl<T extends string>(attribute: T) {
  return `jexl:randomColor(get(feature,'${attribute}'))` as const
}
