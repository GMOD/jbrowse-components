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

// The built-in "color by strand" expression: what **Color by... -> Strand**
// writes into the `color` slot. Unlike the two above this IS read back — it is
// what makes `colorByMode` report 'strand' rather than 'attribute' — so the
// menu that writes it and the getter that reads it must agree.
//
// Spelled `feature.strand`, the short form the docs teach, and NOT
// `get(feature,'strand')`. It was the latter until this commit, which made the
// one expression a user can watch the app produce the one expression our own
// style rule says not to write — and worse, a user who followed the rule and
// typed the short form got a track that painted correctly while the menu radio
// read "attribute", because this is compared by string identity.
//
// The two forms are the same read in every context a color slot is evaluated
// in: `buildJexlContext` is the single path that builds jexl bindings (config
// slots and the filter chain alike) and it wraps every feature in
// `jexlFeatureProxy`, on which `feature.x` and `get(feature,'x')` are
// interchangeable. Nothing has shipped with the old spelling, so there is no
// second form to recognize — keep it that way, and change every writer of this
// string together with it rather than growing a list of accepted spellings.
export const STRAND_COLOR_JEXL =
  "jexl:feature.strand==1?'tomato':feature.strand==-1?'cornflowerblue':'goldenrod'"

// The "color by attribute" expression: a per-value random color, so each
// distinct value of the attribute gets its own stable color. Like
// STRAND_COLOR_JEXL this IS compared against the stored slot value — the
// `colorByAttribute` getter reads the attribute name back out of it — so the
// dialog that writes it and anything else producing one must agree on the shape.
// Generic, so the return type is the exact template rather than `string`: that
// is what lets a caller outside this package pin its own copy against this one
// at compile time (see @jbrowse/img's applyTrackOpts).
//
// This one KEEPS `get(feature,'...')` where STRAND_COLOR_JEXL dropped it, and
// the reason is not back-compat but the attribute name: it is user-supplied and
// arbitrary, so `feature.<name>` is not even legal jexl for anything that is
// not a bare identifier (`gene-id`, `Parent.ID`, a leading digit), while the
// quoted lookup takes any string at all. The short form is the rule for jexl
// you write by hand about a name you know; this is neither.
export function attributeColorJexl<T extends string>(attribute: T) {
  return `jexl:randomColor(get(feature,'${attribute}'))` as const
}
