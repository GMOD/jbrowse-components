import { groupKeyComparator } from '@jbrowse/core/util/groupKeys'
import { pairedColorsOf } from '@jbrowse/display-kit/colorConfigSchema'

import type { RowColorEntries, RowSource } from '@jbrowse/tree-sidebar'

// Ordered: a row joins the first entry whose `match` regex it matches.
export interface RowGroup {
  match: string
  group: string
  color: string
}

export interface CompiledRowGroup extends RowGroup {
  re: RegExp
}

/**
 * The entries whose `match` compiles. An entry whose `match` is not a valid
 * regex matches nothing, so one bad config line costs its own stripe rather
 * than the display.
 */
export function compileRowGroups(rowGroups: RowGroup[]): CompiledRowGroup[] {
  return rowGroups.flatMap(g => {
    try {
      return [{ ...g, re: new RegExp(g.match) }]
    } catch {
      return []
    }
  })
}

/** The first entry a row name matches. */
export function rowGroupOf(
  compiled: readonly CompiledRowGroup[],
  name: string,
) {
  return compiled.find(g => g.re.test(name))
}

/**
 * `entries` under `group`, with each group they leave out taking its own
 * `rowGroups` colour, so the palette deals only to groups that have none.
 */
export function groupColorEntries(
  rowGroups: readonly RowGroup[],
  entries: Pick<RowColorEntries, 'domain' | 'range'>,
) {
  const colors = new Map(pairedColorsOf(entries))
  const listed = colors.size
  for (const { group, color } of rowGroups) {
    if (color && !colors.has(group)) {
      colors.set(group, color)
    }
  }
  return colors.size === listed
    ? entries
    : {
        domain: [...colors.keys()],
        range: [
          ...colors.values(),
          ...entries.range.slice(entries.domain.length),
        ],
      }
}

/**
 * `rowGroups` with each group's colour the one `entries` pair it with, where
 * they pair one.
 */
export function recolorRowGroups(
  rowGroups: RowGroup[],
  entries: Pick<RowColorEntries, 'domain' | 'range'>,
): RowGroup[] {
  const colors = pairedColorsOf(entries)
  return colors.size
    ? rowGroups.map(g => ({ ...g, color: colors.get(g.group) ?? g.color }))
    : rowGroups
}

/**
 * Each row tagged with the group of the first entry its name matches, so
 * `group` reads like any other row attribute.
 */
export function tagRowGroups(
  rows: RowSource[],
  compiled: readonly CompiledRowGroup[],
): RowSource[] {
  return compiled.length
    ? rows.map(row => {
        const hit = rowGroupOf(compiled, row.name)
        return hit ? { ...row, group: hit.group } : row
      })
    : rows
}

/**
 * Each row's sidebar swatch, `labelColor`, set to the colour of the first entry
 * its name matches, where it has none of its own. Not `color`, which this
 * display spends on the per-feature painting.
 */
export function applyRowGroupColors(
  sources: RowSource[],
  rowGroups: RowGroup[],
): RowSource[] {
  const compiled = compileRowGroups(rowGroups)
  return compiled.length
    ? sources.map(s => {
        const hit = rowGroupOf(compiled, s.name)
        return hit?.color && s.labelColor === undefined
          ? { ...s, labelColor: hit.color }
          : s
      })
    : sources
}

/**
 * The row axis is a facet with one row per value, so its order is the facet
 * order: `domain` lists the values that come first, the rest sorted the way
 * every in-track grouping sorts, digits by magnitude and the `''` row last.
 */
export function orderRowValues(
  values: Iterable<string>,
  domain: readonly string[],
): string[] {
  return [...values].sort(groupKeyComparator(domain))
}
