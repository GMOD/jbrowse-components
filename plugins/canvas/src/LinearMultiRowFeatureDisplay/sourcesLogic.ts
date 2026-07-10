import { tagColorPalette } from '@jbrowse/core/ui/theme'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { reconcileLayout } from '@jbrowse/tree-sidebar'

// A row in the painting. `name` is the partition value (the row identity, and
// the tree leaf name); the rest are user arrangement overrides.
export interface MultiRowSource {
  name: string
  label?: string
  color?: string
  group?: string
}

/**
 * The single per-row color resolver (→ ABGR by display row), the one place
 * "color a whole row" is decided. Precedence: the row's interactively-set
 * `color` (arrangement dialog) wins; else the config `sampleColorMap` keyed by
 * the row's partition value; else — only when the `color` slot is left at its
 * default — a categorical palette color by display index. `undefined` rows fall
 * through to the worker-baked per-feature `color` slot (e.g. per-segment
 * `itemRgb` painting), so per-row and per-feature coloring compose.
 */
export function resolveRowColors(
  sources: MultiRowSource[],
  sampleColorMap: Record<string, string>,
  colorSlotIsDefault: boolean,
): (number | undefined)[] {
  return sources.map((s, i) => {
    const css =
      s.color ??
      sampleColorMap[s.name] ??
      (colorSlotIsDefault
        ? tagColorPalette[i % tagColorPalette.length]
        : undefined)
    return css === undefined ? undefined : cssColorToABGR(css)
  })
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
 * currently discovered in the data via the shared `reconcileLayout`. Block
 * colors come per feature, not per row, so no palette synthesis happens here
 * (unlike the multiwiggle sources).
 */
export function buildEditableSources(
  discovered: MultiRowSource[],
  layout: MultiRowSource[],
): MultiRowSource[] {
  return reconcileLayout(discovered, layout)
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
