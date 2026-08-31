import { categoricalPalette } from '@jbrowse/core/ui/colors'
import { compareRowValues } from '@jbrowse/tree-sidebar'

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
 * arrangement dialog, or written into a session's `layout`) keeps that color,
 * but still joins the group and its block — the two are separate questions and
 * only the color was ever the user's. Deciding both off the color put a row
 * that had merely been recolored at the bottom of the list with the rows that
 * matched nothing, which is the one place a reader would not look for it.
 *
 * `partition` is what makes the groups contiguous blocks, and the caller turns
 * it off when something else already owns the row order — in practice a cluster
 * tree, which the swatch stripe is then read ACROSS rather than instead of.
 * Grouping and ordering are two questions about one axis, and only ordering can
 * have a second claimant.
 *
 * An entry whose `match` is not a valid regex matches nothing, so one bad config
 * line costs its own stripe rather than the display.
 */
export function applyRowGroups(
  sources: MultiRowSource[],
  rowGroups: RowGroup[],
  { partition = true }: { partition?: boolean } = {},
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
      // unmatched rows rank after every declared group
      rank: rank === -1 ? compiled.length : rank,
      // incoming position, which is the tiebreak the sort below is stable by
      idx,
    }
  })
  if (!partition) {
    return tagged.map(t => t.source)
  }
  // Stable partition into contiguous blocks, in the order the entries are
  // declared. Marking alone does not survive this scale: 63 wolves spread
  // through 1,987 sorted rows land as five specks that read as noise, where the
  // same rows pulled into one block read as a group whose color profile can be
  // compared against the rest. Within a block the incoming order is preserved,
  // so a `sortRowsBy` still orders each block by the value it sorted on.
  return tagged
    .sort((a, b) => a.rank - b.rank || a.idx - b.idx)
    .map(t => t.source)
}

/**
 * The single per-row color resolver (→ CSS by display row), the one place
 * "color a whole row" is decided. Precedence: the row's interactively-set
 * `color` (arrangement dialog) wins; else the config `sampleColorMap` keyed by
 * the row's partition value; else — only when the `color` slot is left at its
 * default — a categorical palette color by display index. `undefined` rows fall
 * through to the worker-baked per-feature `color` slot (e.g. per-segment
 * `itemRgb` painting), so per-row and per-feature coloring compose.
 *
 * CSS rather than ABGR because the painter is no longer the only consumer: the
 * sidebar label can be tinted with the color its row is painted in
 * (`colorRowLabels`), and that is a DOM/SVG fill. One resolver, two encodings —
 * a label showing a color the blocks beside it are not painted in would be
 * worse than no label color at all.
 *
 * The fallback is `categoricalPalette`, the same wide list the arrangement
 * dialog's palette-by-attribute hands out, so a track's automatic row colors and
 * the colors it takes when a user palettes it by hand come from one place. It
 * replaced `tagColorPalette`, which is the pale tol_light scheme and is right
 * for an alignment read — a fill under a stroked outline that carries the shape
 * — and wrong here, where a block has no outline and, at chromosome zoom, barely
 * any width: `#EEEEBB` on white paper is not a color the eye finds. Its length
 * matters as much as its tone. A partition is twenty-odd repeat classes, and a
 * ten-color list wraps into a second row of blue while the reader is still using
 * color to tell the rows apart.
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
 * Order the discovered partition values: those named in the config `rowOrder`
 * come first in that order, remaining values are appended in sorted order. Empty
 * `rowOrder` = fully sorted.
 *
 * Sorted through `compareRowValues`, which is numeric when both sides are
 * numbers — a partition field is as often a number written as text as it is a
 * name, and a bare `sort()` files a chromHMM run's 25 states as 1, 10, 11, ...,
 * 2, 20. The row-arrangement grid already orders its columns that way.
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
