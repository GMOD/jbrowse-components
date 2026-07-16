// What the `color`/`utrColor` slots resolve to when unset and the feature
// carries no BED color of its own (see getBoxColor). These are pure fallbacks,
// never compared against a stored value: the slots are `maybeColor`, so "unset"
// is `undefined` and every real color — including these two — stays expressible.
// Kept dependency-free so the config schema can import them freely.
export const FEATURE_DEFAULT_COLOR = 'goldenrod'
export const UTR_DEFAULT_COLOR = '#357089'
