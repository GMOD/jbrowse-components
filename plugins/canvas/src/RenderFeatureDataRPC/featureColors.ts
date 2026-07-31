// What the `color`/`utrColor` slots resolve to when unset and the feature
// carries no BED color of its own (see getBoxColor). These are pure fallbacks,
// never compared against a stored value: the slots are `maybeColor`, so "unset"
// is `undefined` and every real color — including these two — stays expressible.
// Kept dependency-free so the config schema can import them freely.
export const FEATURE_DEFAULT_COLOR = 'goldenrod'
export const UTR_DEFAULT_COLOR = '#357089'

// The built-in "color by strand" expression. Unlike the two above this IS
// compared against the stored slot value — an exact match is what makes
// `colorByMode` report 'strand' rather than 'attribute' — so the menu that
// writes it and the getter that recognizes it must share this one string.
export const STRAND_COLOR_JEXL =
  "jexl:get(feature,'strand')==1?'tomato':get(feature,'strand')==-1?'cornflowerblue':'goldenrod'"
