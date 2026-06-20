// A row in the painting. `name` is the partition value (the row identity, and
// the tree leaf name); the rest are user arrangement overrides.
export interface MultiRowSource {
  name: string
  label?: string
  color?: string
  group?: string
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
