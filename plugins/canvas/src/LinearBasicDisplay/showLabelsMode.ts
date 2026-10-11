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
  // v4's labels on with descriptions off has no home on the unified enum: it
  // wants 'auto' rather than 'name', so the density gate is not forfeited.
  return value === false ? (showDescriptions ? 'description' : 'none') : 'auto'
}

/**
 * Which labels a display shows under its `showLabels` mode at a feature
 * density (features per px): `auto` drops descriptions past
 * `maxDescriptionDensity` and names past `maxLabelDensity`, keeping gene names
 * (`geneNamesOnly`) while the genes alone are under it. A pinned mode skips
 * the density gate; collapsed shows none.
 */
export function labelVisibility({
  mode,
  collapsed,
  density,
  geneDensity,
  maxLabelDensity,
  maxDescriptionDensity,
}: {
  mode: ShowLabelsMode
  collapsed: boolean
  density: number
  geneDensity: () => number | undefined
  maxLabelDensity: number
  maxDescriptionDensity: number
}) {
  const auto = mode === 'auto'
  const genes = auto && density > maxLabelDensity ? geneDensity() : undefined
  const geneNamesOnly = genes !== undefined && genes <= maxLabelDensity
  const showLabels =
    !collapsed &&
    modeCanShowName(mode) &&
    (!auto || density <= maxLabelDensity || geneNamesOnly)
  const showDescriptions =
    !collapsed &&
    modeCanShowDescription(mode) &&
    (!auto ||
      (showLabels && !geneNamesOnly && density <= maxDescriptionDensity))
  return { showLabels, geneNamesOnly, showDescriptions }
}
