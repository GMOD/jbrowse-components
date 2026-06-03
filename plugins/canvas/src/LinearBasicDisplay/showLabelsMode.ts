// Single source of truth for the showLabels display setting.
// The model resolves this enum into a concrete boolean (see baseModel
// `showLabels` getter) for all downstream consumers — layout, RPC, SVG export,
// hit testing — so the enum itself never crosses the worker boundary.
export const SHOW_LABELS_MODES = ['on', 'off'] as const

export type ShowLabelsMode = (typeof SHOW_LABELS_MODES)[number]

// Legacy configs stored showLabels as a boolean or as the old 'auto' enum
// value. Normalize all to 'on'/'off'.
export function legacyShowLabelsToMode(value: unknown): ShowLabelsMode {
  return value === false || value === 'off' ? 'off' : 'on'
}
