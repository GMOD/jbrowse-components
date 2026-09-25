import { groupKeyComparator } from '@jbrowse/core/util/groupKeys'

import type { RowSource } from '@jbrowse/tree-sidebar'

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
 * Each row tagged with the group of the first entry its name matches, in the
 * order the rows came in. The group color lands in `labelColor` (the sidebar
 * swatch) rather than `color`, which this display spends on the per-feature
 * painting; `facet: 'group'` is what stacks the groups in bands.
 */
export function applyRowGroups(
  sources: RowSource[],
  rowGroups: RowGroup[],
): RowSource[] {
  const compiled = compileRowGroups(rowGroups)
  return compiled.length
    ? sources.map(s => {
        const hit = rowGroupOf(compiled, s.name)
        return hit
          ? { ...s, group: hit.group, labelColor: s.labelColor ?? hit.color }
          : s
      })
    : sources
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
