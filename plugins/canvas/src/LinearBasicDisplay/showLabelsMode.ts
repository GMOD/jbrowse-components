// Single source of truth for the showLabels display setting.
//
// 'auto' hides labels once feature density crosses a readability threshold,
// 'on' always shows, 'off' always hides. The model resolves this enum into a
// concrete boolean (see baseModel `showLabels` getter) for all downstream
// consumers — layout, RPC, SVG export, hit testing — so the enum itself never
// crosses the worker boundary.
export const SHOW_LABELS_MODES = ['auto', 'on', 'off'] as const

export type ShowLabelsMode = (typeof SHOW_LABELS_MODES)[number]

// Legacy configs (and renderer sub-configs lifted onto the display) stored
// showLabels as a boolean. true → 'auto' preserves "labels visible at sparse
// zooms" while gaining density-based hide at zoom-out; false → 'off'.
export function legacyShowLabelsToMode(value: unknown): ShowLabelsMode {
  return value === false ? 'off' : 'auto'
}
