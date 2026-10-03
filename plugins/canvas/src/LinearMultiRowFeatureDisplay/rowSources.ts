import { groupKeyComparator } from '@jbrowse/core/util/groupKeys'

import type { RowSource } from '@jbrowse/tree-sidebar'

// Ordered: a row joins the first entry whose `match` regex it matches.
export interface RowGroup {
  match: string
  group: string
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
