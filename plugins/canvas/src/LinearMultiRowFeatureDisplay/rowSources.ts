import { categoricalPalette } from '@jbrowse/core/ui/colors'
import { isCssColor } from '@jbrowse/core/util/cssColorParse'
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
 * the sidebar label is tinted with the same color its row paints in: a row's
 * `rowColor` entry, else a palette entry. An `undefined` row falls through to
 * the worker-baked per-feature `color`, so per-row and per-feature coloring
 * compose. The palette is dealt over `paletteOrder`, the rows in the order the
 * config declares, and looked up by name, so a reorder or a clade focus moves a
 * row without recoloring it; undefined deals none.
 */
export function resolveRowColorStrings(
  rows: MultiRowSource[],
  paletteOrder: readonly MultiRowSource[] | undefined,
): (string | undefined)[] {
  const slot = new Map(paletteOrder?.map((s, i) => [s.name, i]))
  return rows.map(s => {
    const i = slot.get(s.name)
    return (
      s.color ??
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
  values: Iterable<string>,
  domain: readonly string[],
): string[] {
  return [...values].sort(groupKeyComparator(domain))
}

/**
 * The discovered rows in the reader's arrangement: ordered by `domain` the way
 * {@link orderPartitionValues} orders values, a `labels` entry over the
 * derived label, and a `colors` entry as the row's `color`.
 */
export function arrangeRows(
  discovered: readonly MultiRowSource[],
  {
    domain,
    labels,
    colors,
  }: {
    domain: readonly string[]
    labels: Readonly<Record<string, string>>
    colors: ReadonlyMap<string, string>
  },
): MultiRowSource[] {
  const byName = new Map(discovered.map(s => [s.name, s]))
  return orderPartitionValues(byName.keys(), domain).map(name => {
    const row = byName.get(name)!
    const label = labels[name]
    const color = colors.get(name)
    return label === undefined && color === undefined
      ? row
      : {
          ...row,
          ...(label === undefined ? {} : { label }),
          ...(color === undefined ? {} : { color }),
        }
  })
}

/**
 * What the arrangement dialog's rows say beyond what was discovered: a label
 * other than the derived one, and a colour. The whole of `rows.labels` and
 * `rowColor`, rebuilt, so an edit cleared in the dialog is cleared in the
 * config. The colour pairs keep `baseOrder`, the config's own
 * `rowColor.domain`, ahead of any new value, so a reorder that changes no
 * colour writes the config's pairs back unchanged. A string the painters
 * cannot parse is left out rather than stored.
 */
export function rowEditsOf(
  rows: readonly MultiRowSource[],
  discovered: readonly MultiRowSource[],
  baseOrder: readonly string[],
) {
  const byName = new Map(discovered.map(s => [s.name, s]))
  const labels: Record<string, string> = {}
  const colors = new Map<string, string>()
  for (const row of rows) {
    if (row.label !== undefined && row.label !== byName.get(row.name)?.label) {
      labels[row.name] = row.label
    }
    if (row.color !== undefined && isCssColor(row.color)) {
      colors.set(row.name, row.color)
    }
  }
  const domain = [
    ...baseOrder.filter(name => colors.has(name)),
    ...[...colors.keys()].filter(name => !baseOrder.includes(name)),
  ]
  return {
    labels,
    rowColor: { domain, range: domain.map(name => colors.get(name)!) },
  }
}
