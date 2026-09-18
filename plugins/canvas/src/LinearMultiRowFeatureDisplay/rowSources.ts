import { categoricalPalette } from '@jbrowse/core/ui/colors'
import { groupKeyComparator } from '@jbrowse/core/util/groupKeys'

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
 * per-row and per-feature coloring compose. The palette is dealt over
 * `paletteOrder`, the rows as discovered, and looked up by name, so a reorder or
 * a clade focus moves a row without recoloring it; undefined deals none.
 */
export function resolveRowColorStrings(
  rows: MultiRowSource[],
  sampleColorMap: Record<string, string>,
  paletteOrder: readonly MultiRowSource[] | undefined,
): (string | undefined)[] {
  const slot = new Map(paletteOrder?.map((s, i) => [s.name, i]))
  return rows.map(s => {
    const i = slot.get(s.name)
    return (
      s.color ??
      sampleColorMap[s.name] ??
      (i === undefined
        ? undefined
        : categoricalPalette[i % categoricalPalette.length])
    )
  })
}

/**
 * The row axis is a facet with one row per value, so its order is the facet
 * order: `domain` lists the values that come first, the rest sorted the way
 * every in-track grouping sorts, digits by magnitude and the `''` row last.
 */
export function orderPartitionValues(
  values: Set<string>,
  domain: readonly string[],
): string[] {
  return [...values].sort(groupKeyComparator(domain))
}
