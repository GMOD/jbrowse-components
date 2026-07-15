// Default value of the multi-row display `color` slot. When the slot is left at
// this value (and no sampleColorMap entry applies), each row is assigned a
// distinct categorical-palette color on the main thread at render time — see
// resolveRowColors in sourcesLogic. Shared so the config-schema default and the
// is-default check can't drift. Kept dependency-free so the config schema can
// import it freely.
export const MULTIROW_DEFAULT_COLOR = 'goldenrod'
