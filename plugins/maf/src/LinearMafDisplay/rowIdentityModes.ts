// Single source of truth for the per-row identity modes: [value, menu label].
// The state enumeration derives its valid values, the track menu derives its
// radio items, and the draw function's mode type derives from the non-`none`
// entries — so the three can't drift. Mirrors wiggle's `WIGGLE_RENDERINGS`.
export const ROW_IDENTITY_MODES = [
  ['none', 'Off'],
  ['heatmap', 'Heatmap'],
  ['xyplot', 'X-Y plot'],
] as const

export const ROW_IDENTITY_MODE_VALUES = ROW_IDENTITY_MODES.map(
  ([value]) => value,
)

/** Any per-row identity menu choice, including the `none` (off) state. */
export type RowIdentityModeWithOff = (typeof ROW_IDENTITY_MODES)[number][0]

/** The active drawing modes (everything except `none`). */
export type RowIdentityMode = Exclude<RowIdentityModeWithOff, 'none'>
