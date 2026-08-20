import { featureDefaultColor } from '@jbrowse/core/ui/palette'

// What the `color`/`utrColor` slots resolve to when unset and the feature
// carries no BED color of its own. Pure fallbacks, never compared against a
// stored value — the slots are `maybeColor`, so "unset" is `undefined` and every
// real color stays expressible. Dependency-free (core's palette imports no
// toolkit and loads in a worker) so the config schema can import them.
//
// The box color is core's rather than this plugin's because the multi-sample
// variant display's lane paints an uncolored record with it too, and the two
// must be the same goldenrod or a lane over a genotype matrix reads as a
// different track from a LinearVariantDisplay over the same VCF.
export const FEATURE_DEFAULT_COLOR = featureDefaultColor
export const UTR_DEFAULT_COLOR = '#357089'

// What **Color by... → Strand** writes into the `color` slot. Unlike the two
// above this IS read back — it is what makes `colorByMode` report 'strand'
// rather than 'attribute' — and the comparison is by string identity, so every
// writer of this expression has to change with it rather than growing a list of
// accepted spellings.
//
// `feature.strand`, the short form the docs teach, not `get(feature,'strand')`:
// the one expression a user can watch the app produce should not be the one our
// own style rule says not to write, and a user who typed the short form got a
// track that painted correctly while the menu radio read "attribute".
export const STRAND_COLOR_JEXL =
  "jexl:feature.strand==1?'tomato':feature.strand==-1?'cornflowerblue':'goldenrod'"

// **Color by attribute**: a per-value random color, so each distinct value gets
// its own stable one. Compared against the stored slot the same way — the
// `colorByAttribute` getter reads the attribute name back out of it. Generic, so
// the return type is the exact template rather than `string`, which lets a
// caller outside this package pin its own copy against this one at compile time
// (see @jbrowse/img's applyTrackOpts).
//
// Keeps `get(feature,'…')` where STRAND_COLOR_JEXL drops it, because the
// attribute name is user-supplied: `feature.<name>` is not legal jexl for
// anything but a bare identifier (`gene-id`, `Parent.ID`, a leading digit),
// while the quoted lookup takes any string.
export function attributeColorJexl<T extends string>(attribute: T) {
  return `jexl:randomColor(get(feature,'${attribute}'))` as const
}
