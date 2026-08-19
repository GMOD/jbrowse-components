/**
 * The size presets a canvas display draws at, and the subfeature-label modes,
 * each as a `[value, menu label]` table.
 *
 * `compact` halves the row height, `superCompact` quarters it, `collapsed`
 * packs every feature onto a single row and suppresses all labels (name,
 * description, and subfeature) for a dense one-line overview.
 *
 * One source per enum: the config schema's `types.enumeration` spreads the
 * value list, the resolved `DisplayConfig` field types read off it, and the
 * track menu builds its radios from the same table. The unset inherit state is
 * not a member of either — both slots are promotable `maybeStringEnum`s.
 *
 * Here rather than beside the menus that render them because the website's
 * figure recipes name these labels in a click path, and the node script that
 * builds them cannot load a module importing React, MUI or a lazy `.tsx`. A
 * leaf module makes the recipe import the label instead of retyping it.
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
