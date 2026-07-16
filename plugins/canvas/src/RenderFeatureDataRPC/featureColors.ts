// Defaults of the feature `color`/`utrColor` slots. A slot left at its default
// means "nothing asked for a color here", which is what lets the worker fall
// back to a feature's own BED itemRgb (see getBoxColor). Shared so the config
// schema defaults and the is-default checks can't drift. Kept dependency-free
// so the config schema can import it freely.
export const FEATURE_DEFAULT_COLOR = 'goldenrod'
export const UTR_DEFAULT_COLOR = '#357089'
