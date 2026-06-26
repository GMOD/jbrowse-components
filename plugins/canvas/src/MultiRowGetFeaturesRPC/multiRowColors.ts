// Default value of the multi-row display `color` slot. When the slot is left at
// this value (and no sampleColorMap entry applies), the worker auto-assigns each
// row a distinct color from a categorical palette — see packMultiRowFeatures.
// Shared so the config-schema default and the worker's is-default check can't
// drift. Kept dependency-free so the config schema can import it freely.
export const MULTIROW_DEFAULT_COLOR = 'goldenrod'
