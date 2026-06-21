// A row in the painting. `name` is the partition value (the row identity, and
// the tree leaf name); the rest are user arrangement overrides.
export interface MultiRowSource {
  name: string
  label?: string
  color?: string
  group?: string
}

/**
 * Order the discovered partition values: those named in the config `rowOrder`
 * come first in that order, remaining values are appended in sorted order. Empty
 * `rowOrder` = fully sorted.
 */
export function orderPartitionValues(
  values: Set<string>,
  rowOrder: readonly string[],
): string[] {
  const listed = rowOrder.filter(v => values.has(v))
  const seen = new Set(listed)
  const rest = [...values].filter(v => !seen.has(v)).sort()
  return [...listed, ...rest]
}

/**
 * Reconcile the persisted `layout` (user reorder/relabel) against the rows
 * currently discovered in the data: keep layout order, drop rows no longer
 * present, append newly-seen rows in discovered order. Empty layout = discovered
 * order. Mirrors the multiwiggle `buildEditableSources` reconcile (minus the
 * wiggle-only `source` alias and palette synthesis — block colors come per
 * feature, not per row).
 */
export function buildEditableSources(
  discovered: MultiRowSource[],
  layout: MultiRowSource[],
): MultiRowSource[] {
  if (!layout.length) {
    return discovered
  }
  const byName = new Map(discovered.map(s => [s.name, s]))
  const laidOut = layout.flatMap(s => {
    const info = byName.get(s.name)
    return info ? [{ ...info, ...s }] : []
  })
  const inLayout = new Set(layout.map(s => s.name))
  const appended = discovered.filter(s => !inLayout.has(s.name))
  return [...laidOut, ...appended]
}

/** Narrow the editable rows by the active subtree filter (tree-sidebar). */
export function buildSources(
  editable: MultiRowSource[],
  subtreeFilter: readonly string[] | undefined,
): MultiRowSource[] {
  if (!subtreeFilter?.length) {
    return editable
  }
  const filter = new Set(subtreeFilter)
  return editable.filter(s => filter.has(s.name))
}
