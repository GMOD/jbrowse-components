export type MultiWayRibbonColorBy = 'default' | 'strand' | 'identity'

export const RIBBON_COLOR_MODES: readonly (readonly [
  MultiWayRibbonColorBy,
  string,
])[] = [
  ['default', 'Default'],
  ['strand', 'Strand'],
  ['identity', 'Identity'],
]
