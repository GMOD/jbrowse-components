/**
 * @deprecated `labels.name.show` and `labels.description.show` replace the
 * five-value `showLabels`; kept for plugins that imported it.
 */
export const SHOW_LABELS_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'nameAndDescription', label: 'Name + description' },
  { value: 'name', label: 'Name only' },
  { value: 'description', label: 'Description only' },
  { value: 'none', label: 'None' },
] as const

/** @deprecated see `SHOW_LABELS_OPTIONS` */
export type ShowLabelsMode = (typeof SHOW_LABELS_OPTIONS)[number]['value']

/** @deprecated see `SHOW_LABELS_OPTIONS` */
export const SHOW_LABELS_MODES = SHOW_LABELS_OPTIONS.map(o => o.value)

/** @deprecated read `labels.name.show` */
export function modeCanShowName(mode: ShowLabelsMode) {
  return mode === 'auto' || mode === 'nameAndDescription' || mode === 'name'
}

/** @deprecated read `labels.description.show` */
export function modeCanShowDescription(mode: ShowLabelsMode) {
  return (
    mode === 'auto' || mode === 'nameAndDescription' || mode === 'description'
  )
}

/**
 * Which labels a display draws at a feature density (features per px): a
 * shown name past `maxLabelDensity` only where the genes alone are under it
 * (`geneNamesOnly`), a shown description only under the lower of the two
 * thresholds, and nothing while collapsed.
 */
export function labelVisibility({
  name,
  description,
  collapsed,
  density,
  geneDensity,
  maxLabelDensity,
  maxDescriptionDensity,
}: {
  name: boolean
  description: boolean
  collapsed: boolean
  density: number
  geneDensity: () => number | undefined
  maxLabelDensity: number
  maxDescriptionDensity: number
}) {
  const genes =
    name && !collapsed && density > maxLabelDensity ? geneDensity() : undefined
  const geneNamesOnly = genes !== undefined && genes <= maxLabelDensity
  const showLabels =
    name && !collapsed && (density <= maxLabelDensity || geneNamesOnly)
  const showDescriptions =
    description &&
    !collapsed &&
    density <= Math.min(maxDescriptionDensity, maxLabelDensity)
  return { showLabels, geneNamesOnly, showDescriptions }
}
