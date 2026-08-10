// Single source of truth for the per-row identity values. The config
// enumeration derives its valid values, the draw function's mode type derives
// from the non-`none` entries, and `isRowIdentityMode` narrows to those — so
// nothing has to hand-list the pair.
//
// No menu labels here, unlike `conservationModes.ts`: the two identity plots
// are alternatives within the one "Row coloring" choice rather than a menu of
// their own, so they are named alongside the renderings they compete with, in
// `rowRenderings.ts`.
export const ROW_IDENTITY_MODE_VALUES = ['none', 'heatmap', 'xyplot'] as const

/** Any per-row identity setting, including the `none` (off) state. */
export type RowIdentityModeWithOff = (typeof ROW_IDENTITY_MODE_VALUES)[number]

/** The active drawing modes (everything except `none`). */
export type RowIdentityMode = Exclude<RowIdentityModeWithOff, 'none'>

// Derived rather than written out, so this can't disagree with the enumeration
// above about which values draw a plot.
const DRAWN_MODES: ReadonlySet<string> = new Set(
  ROW_IDENTITY_MODE_VALUES.filter(v => v !== 'none'),
)

/**
 * Narrow a row-rendering choice to the two that draw an identity plot.
 *
 * The alternative is a hand-listed `x === 'heatmap' || x === 'xyplot'`, which
 * two call sites in the state model had — one deciding which slot
 * `setRowRendering` writes, one deciding which color key the legend shows — and
 * which a third mode would leave silently wrong in both.
 */
export function isRowIdentityMode(value: string): value is RowIdentityMode {
  return DRAWN_MODES.has(value)
}
