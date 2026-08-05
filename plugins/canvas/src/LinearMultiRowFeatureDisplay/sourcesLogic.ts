import { tagColorPalette } from '@jbrowse/core/ui/palette'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

// A row in the painting. `name` is the partition value (the row identity, and
// the tree leaf name); the rest are user arrangement overrides. `labelColor`
// tints the sidebar swatch only — never the blocks — see `applyRowGroups`.
export interface MultiRowSource {
  name: string
  label?: string
  color?: string
  group?: string
  labelColor?: string
}

// One `rowGroups` config entry: rows whose name matches `match` (a regex) join
// `group` and take `color` as their sidebar swatch. Ordered — first match wins.
export interface RowGroup {
  match: string
  group: string
  color: string
}

/**
 * Tag each row with the first `rowGroups` entry whose pattern its name matches,
 * taking that entry's color as the row's `labelColor`.
 *
 * The color lands in `labelColor` (the sidebar swatch) rather than `color` (the
 * blocks) because this display spends `color` on the painting — a per-feature
 * `itemRgb` copy-number ramp, say — so a group hue there would overwrite the
 * encoding the track is read by. Same split multiwiggle density mode makes for
 * the same reason.
 *
 * A row that already carries an explicit `labelColor` (set through the
 * arrangement dialog) keeps it. An entry whose `match` is not a valid regex
 * matches nothing, so one bad config line costs its own stripe rather than the
 * display.
 */
export function applyRowGroups(
  sources: MultiRowSource[],
  rowGroups: RowGroup[],
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
  const tagged = sources.map(s => {
    const rank =
      s.labelColor === undefined
        ? compiled.findIndex(g => g.re.test(s.name))
        : -1
    const hit = rank === -1 ? undefined : compiled[rank]!
    return {
      source: hit ? { ...s, group: hit.group, labelColor: hit.color } : s,
      // unmatched rows rank after every declared group
      rank: rank === -1 ? compiled.length : rank,
    }
  })
  // Stable partition into contiguous blocks, in the order the entries are
  // declared. Marking alone does not survive this scale: 63 wolves spread
  // through 1,987 sorted rows land as five specks that read as noise, where the
  // same rows pulled into one block read as a group whose color profile can be
  // compared against the rest. Within a block the incoming order is preserved,
  // so a `sortRowsBy` still orders each block by the value it sorted on.
  return tagged
    .map((t, idx) => ({ ...t, idx }))
    .sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.idx - b.idx))
    .map(t => t.source)
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
  const listed = [...new Set(rowOrder)].filter(v => values.has(v))
  const seen = new Set(listed)
  const rest = [...values].filter(v => !seen.has(v)).sort()
  return [...listed, ...rest]
}
