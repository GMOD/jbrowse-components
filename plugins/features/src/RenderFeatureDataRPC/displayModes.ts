/**
 * The size presets a feature display draws at. `compact` and `superCompact`
 * shrink the row by `HEIGHT_MULTIPLIERS`, and `collapsed` packs every feature
 * onto one row with all labels suppressed.
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

export const SUBFEATURE_LABEL_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'none', label: 'Off' },
  { value: 'below', label: 'Below' },
  { value: 'overlay', label: 'Overlay' },
] as const

export type SubfeatureLabels =
  (typeof SUBFEATURE_LABEL_OPTIONS)[number]['value']

export const SUBFEATURE_LABELS = SUBFEATURE_LABEL_OPTIONS.map(o => o.value)

export const SUBFEATURE_LABEL_PLACEMENTS = ['auto', 'below', 'overlay'] as const

export type SubfeatureLabelPlacementSetting =
  (typeof SUBFEATURE_LABEL_PLACEMENTS)[number]

/** `labels.subfeatures` as the one mode the worker bakes. */
export function subfeatureLabelsOf({
  show,
  placement,
}: {
  show: boolean
  placement: SubfeatureLabelPlacementSetting
}): SubfeatureLabels {
  return show ? placement : 'none'
}
