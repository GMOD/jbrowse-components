/**
 * The two shapes an arc display can draw a connection as. One source of truth:
 * the config schema's `types.enumeration` spreads the value list, the track menu
 * builds its radios off the same table.
 *
 * `[value, menu label]`, the `makeRadioSubMenu` shape — the same table every
 * other display's single-choice "what does this draw" submenu is built from
 * (wiggle's plot type, MAF's row coloring, Hi-C's color scheme). Order is menu
 * order.
 */
export const ARC_DISPLAY_MODE_OPTIONS = [
  ['arcs', 'Arcs'],
  ['semicircles', 'Semi-circles'],
] as const

export type ArcDisplayMode = (typeof ARC_DISPLAY_MODE_OPTIONS)[number][0]

export const ARC_DISPLAY_MODES = ARC_DISPLAY_MODE_OPTIONS.map(
  ([value]) => value,
)
