import {
  MAX_DESCRIPTION_FEATURE_DENSITY,
  MAX_LABEL_FEATURE_DENSITY,
} from '../RenderFeatureDataRPC/zoomThresholds.ts'

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
 * shown name past `MAX_LABEL_FEATURE_DENSITY` only where the genes alone are
 * under it (`geneNamesOnly`), a shown description only under
 * `MAX_DESCRIPTION_FEATURE_DENSITY`, and nothing while collapsed.
 */
export function labelVisibility({
  name,
  description,
  collapsed,
  density,
  geneDensity,
}: {
  name: boolean
  description: boolean
  collapsed: boolean
  density: number
  geneDensity: () => number | undefined
}) {
  const genes =
    name && !collapsed && density > MAX_LABEL_FEATURE_DENSITY
      ? geneDensity()
      : undefined
  const geneNamesOnly =
    genes !== undefined && genes <= MAX_LABEL_FEATURE_DENSITY
  const showLabels =
    name &&
    !collapsed &&
    (density <= MAX_LABEL_FEATURE_DENSITY || geneNamesOnly)
  const showDescriptions =
    description && !collapsed && density <= MAX_DESCRIPTION_FEATURE_DENSITY
  return { showLabels, geneNamesOnly, showDescriptions }
}
