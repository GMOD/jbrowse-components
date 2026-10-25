import { groupKeyComparator } from '@jbrowse/core/util/groupKeys'

export {
  compileRowGroups,
  rowGroupOf,
  tagRowGroups,
} from '@jbrowse/tree-sidebar/rowGroups'
export type {
  CompiledRowGroup,
  RowGroup,
} from '@jbrowse/tree-sidebar/rowGroups'

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
