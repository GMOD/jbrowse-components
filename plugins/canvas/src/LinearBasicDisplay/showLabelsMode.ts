// The labels ride here rather than beside the radio because the website's
// figure recipes name them, and that node script cannot load a module
// importing React.
export const SHOW_LABELS_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'nameAndDescription', label: 'Name + description' },
  { value: 'name', label: 'Name only' },
  { value: 'description', label: 'Description only' },
  { value: 'none', label: 'None' },
] as const

export type ShowLabelsMode = (typeof SHOW_LABELS_OPTIONS)[number]['value']

export const SHOW_LABELS_MODES = SHOW_LABELS_OPTIONS.map(o => o.value)

export function modeCanShowName(mode: ShowLabelsMode) {
  return mode === 'auto' || mode === 'nameAndDescription' || mode === 'name'
}

export function modeCanShowDescription(mode: ShowLabelsMode) {
  return (
    mode === 'auto' || mode === 'nameAndDescription' || mode === 'description'
  )
}

export function legacyShowLabelsToMode(
  value: unknown,
  showDescriptions: boolean,
): ShowLabelsMode {
  const withDescriptions = (a: ShowLabelsMode, b: ShowLabelsMode) =>
    showDescriptions ? a : b
  return value === false || value === 'off'
    ? withDescriptions('description', 'none')
    : value === 'on'
      ? withDescriptions('nameAndDescription', 'name')
      : // 'auto' + descriptions off has no home on the unified enum: it wants a
        // 'auto' rather than 'name', so the density gate is not silently
        // forfeited.
        'auto'
}
