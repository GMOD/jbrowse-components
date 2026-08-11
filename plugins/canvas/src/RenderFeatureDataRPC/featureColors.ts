import { featureDefaultColor } from '@jbrowse/core/ui/palette'

// What the `color`/`utrColor` slots resolve to when unset and the feature
// carries no BED color of its own (see getBoxColor). These are pure fallbacks,
// never compared against a stored value: the slots are `maybeColor`, so "unset"
// is `undefined` and every real color — including these two — stays expressible.
// Kept dependency-free (core's palette module imports no toolkit and loads in a
// worker) so the config schema can import them freely.
//
// The box color is core's, not this plugin's: the multi-sample variant display's
// lane paints an uncolored record with it too, and the two have to be the same
// goldenrod or a lane over a genotype matrix reads as a different track from a
// LinearVariantDisplay over the same VCF. Re-exported under this name because
// every call site in this plugin already spells it this way.
export const FEATURE_DEFAULT_COLOR = featureDefaultColor
export const UTR_DEFAULT_COLOR = '#357089'

// The built-in "color by strand" expression. Unlike the two above this IS
// compared against the stored slot value — an exact match is what makes
// `colorByMode` report 'strand' rather than 'attribute' — so the menu that
// writes it and the getter that recognizes it must share this one string.
export const STRAND_COLOR_JEXL =
  "jexl:get(feature,'strand')==1?'tomato':get(feature,'strand')==-1?'cornflowerblue':'goldenrod'"

// The "color by attribute" expression: a per-value random color, so each
// distinct value of the attribute gets its own stable color. Like
// STRAND_COLOR_JEXL this IS compared against the stored slot value — the
// `colorByAttribute` getter reads the attribute name back out of it — so the
// dialog that writes it and anything else producing one must agree on the shape.
// Generic, so the return type is the exact template rather than `string`: that
// is what lets a caller outside this package pin its own copy against this one
// at compile time (see @jbrowse/img's applyTrackOpts).
export function attributeColorJexl<T extends string>(attribute: T) {
  return `jexl:randomColor(get(feature,'${attribute}'))` as const
}
