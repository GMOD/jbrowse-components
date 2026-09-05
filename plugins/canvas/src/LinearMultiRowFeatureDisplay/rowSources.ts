import { categoricalPalette } from '@jbrowse/core/ui/colors'
import { compareRowValues } from '@jbrowse/tree-sidebar'

// `labelColor` tints the sidebar swatch only, never the blocks.
export interface MultiRowSource {
  name: string
  label?: string
  color?: string
  group?: string
  labelColor?: string
}

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
  sources: MultiRowSource[],
  rowGroups: RowGroup[],
  { partition }: { partition: boolean },
): MultiRowSource[] {
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
 * the sidebar label is tinted with the same color its row paints in. An
 * `undefined` row falls through to the worker-baked per-feature `color`, so
 * per-row and per-feature coloring compose.
 */
export function resolveRowColorStrings(
  sources: MultiRowSource[],
  sampleColorMap: Record<string, string>,
  colorSlotIsDefault: boolean,
): (string | undefined)[] {
  return sources.map((s, i) => {
    return (
      s.color ??
      sampleColorMap[s.name] ??
      (colorSlotIsDefault
        ? categoricalPalette[i % categoricalPalette.length]
        : undefined)
    )
  })
}

/**
 * Values named in `rowOrder` come first, the rest sorted through
 * `compareRowValues`, which compares numerically when both sides are numbers —
 * a bare `sort()` files a chromHMM run's 25 states as 1, 10, 11, 2, 20.
 */
export function orderPartitionValues(
  values: Set<string>,
  rowOrder: readonly string[],
): string[] {
  const listed = [...new Set(rowOrder)].filter(v => values.has(v))
  const seen = new Set(listed)
  const rest = [...values].filter(v => !seen.has(v)).sort(compareRowValues)
  return [...listed, ...rest]
}
