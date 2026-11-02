/**
 * The rows a focus keeps, as `isRowVisible` reads them, for the worker's fetch
 * and the display's `clusterableSources` alike: the focus as given, a copy
 * row (`hg38~2`) kept by its own name or its sample's. A focus naming no row
 * keeps none, and the display says so. Undefined is every row.
 */
export function visibleSamples(focus: readonly string[] | undefined) {
  return focus?.length ? new Set(focus) : undefined
}
