/**
 * The size presets a canvas display draws at. `compact` halves the row height,
 * `superCompact` quarters it, and `collapsed` packs every feature onto one row
 * with all labels suppressed.
 *
 * A leaf module rather than one beside the menus, because the website's figure
 * recipes import these labels and the node script that builds them cannot load
 * a module importing React, MUI or a lazy `.tsx`.
 */
export const DISPLAY_MODE_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'compact', label: 'Compact' },
  { value: 'superCompact', label: 'Super-compact' },
  { value: 'collapsed', label: 'Collapsed' },
] as const

export type DisplayMode = (typeof DISPLAY_MODE_OPTIONS)[number]['value']

export const DISPLAY_MODES = DISPLAY_MODE_OPTIONS.map(o => o.value)

export function isDisplayMode(value: unknown): value is DisplayMode {
  return (DISPLAY_MODES as readonly string[]).includes(value as string)
}

// 'none' is the promotedBase of the promotable slot; every option is still
// customizable so any mode can be promoted back over another session default.
export const SUBFEATURE_LABEL_OPTIONS = [
  { value: 'none', label: 'Off' },
  { value: 'below', label: 'Below' },
  { value: 'overlay', label: 'Overlay' },
] as const

export type SubfeatureLabels =
  (typeof SUBFEATURE_LABEL_OPTIONS)[number]['value']

export const SUBFEATURE_LABELS = SUBFEATURE_LABEL_OPTIONS.map(o => o.value)
