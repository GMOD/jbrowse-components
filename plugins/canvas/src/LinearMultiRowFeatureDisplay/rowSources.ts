import { groupKeyComparator } from '@jbrowse/core/util/groupKeys'

import type { RowSource } from '@jbrowse/tree-sidebar'

// Ordered: a row joins the first entry whose `match` regex it matches.
export interface RowGroup {
  match: string
  group: string
  color: string
}

/**
 * The group color lands in `labelColor` (the sidebar swatch) rather than
 * `color`, which this display spends on the per-feature painting. An entry
 * whose `match` is not a valid regex matches nothing, so one bad config line
 * costs its own stripe rather than the display.
 */
export function applyRowGroups(
  sources: RowSource[],
  rowGroups: RowGroup[],
  { partition }: { partition: boolean },
): RowSource[] {
  const compiled = rowGroups.flatMap(g => {
    try {
      return [{ ...g, re: new RegExp(g.match) }]
    } catch {
      return []
    }
  })
  if (!compiled.length) {
    return sources
  }
  const tagged = sources.map((s, idx) => {
    const rank = compiled.findIndex(g => g.re.test(s.name))
    const hit = rank === -1 ? undefined : compiled[rank]!
    return {
      source: hit
        ? { ...s, group: hit.group, labelColor: s.labelColor ?? hit.color }
        : s,
      rank: rank === -1 ? compiled.length : rank,
      idx,
    }
  })
  if (!partition) {
    return tagged.map(t => t.source)
  }
  // Within a block the incoming order survives, so a `sortRowsBy` still orders
  // each block by the value it sorted on.
  return tagged
    .sort((a, b) => a.rank - b.rank || a.idx - b.idx)
    .map(t => t.source)
}

/**
 * The one place "color a whole row" is decided, in CSS rather than ABGR because
 * the sidebar label is tinted with the same color its row paints in: a row's
 * `rowColor` entry, else its `palette` colour, by name. An `undefined` row
 * falls through to the worker-baked per-feature `color`, so per-row and
 * per-feature coloring compose; an undefined palette deals none.
 */
export function resolveRowColorStrings(
  rows: RowSource[],
  palette: ReadonlyMap<string, string> | undefined,
): (string | undefined)[] {
  return rows.map(s => s.color ?? palette?.get(s.name))
}

/**
 * The row axis is a facet with one row per value, so its order is the facet
 * order: `domain` lists the values that come first, the rest sorted the way
 * every in-track grouping sorts, digits by magnitude and the `''` row last.
 */
export function orderPartitionValues(
  values: Iterable<string>,
  domain: readonly string[],
): string[] {
  return [...values].sort(groupKeyComparator(domain))
}
