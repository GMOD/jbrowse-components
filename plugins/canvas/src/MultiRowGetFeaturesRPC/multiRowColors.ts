// What the multi-row `color` slot resolves to when unset and the feature
// carries no BED color of its own. Mostly invisible in that case: an unset slot
// is also what turns on the per-row categorical palette, which paints over this
// on the main thread (see resolveRowColors in sourcesLogic). A pure fallback,
// never compared against a stored value — the slot is a `maybeColor`, so
// "unset" is `undefined` and every real color stays expressible.
export const MULTIROW_DEFAULT_COLOR = 'goldenrod'
