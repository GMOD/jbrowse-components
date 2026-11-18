import { buildSearchText } from '../shared/searchText.ts'
import { getRowStr } from './components/util.ts'
import { getRootKeys } from './tableUtil.ts'

import type { Row } from './components/util.ts'

/**
 * The text a free-text query matches a row against: every column the grid
 * renders — name, category, adapter, description and each metadata column —
 * normalized by buildSearchText, which the tree's rows go through too. Built
 * once per row in searchTexts, only while the table does the search, so a
 * keystroke neither re-reads configs nor re-strips HTML.
 */
export function rowSearchText(row: {
  name: string
  kind?: string
  category?: string
  adapter?: string
  description?: string
  metadata: Record<string, unknown>
}) {
  return buildSearchText([
    row.name,
    row.kind,
    row.category,
    row.adapter,
    row.description,
    ...getRootKeys(row.metadata).map(key => row.metadata[key]),
  ])
}

function filterSets(filters: Map<string, string[]>) {
  return [...filters].map(([key, vals]) => [key, new Set(vals)] as const)
}

/**
 * Keeps rows whose value for each actively-filtered facet is one of the
 * selected values. Facets with no selection don't constrain anything.
 */
export function filterRowsByFacets<T extends Row>(
  rows: T[],
  filters: Map<string, string[]>,
): T[] {
  const active = filterSets(filters)
  return rows.filter(row =>
    active.every(([key, set]) => set.has(getRowStr(key, row))),
  )
}

/**
 * One facet's value counts for its filter chip, over the rows that pass every
 * *other* active facet but not its own selection, so its options keep showing
 * the counts you'd get by switching to them. Every active filter counts, not
 * just those offered as chips: a filter on a field that stopped grouping
 * tracks still narrows the grid.
 */
export function countFacetValues<T extends Row>(
  rows: T[],
  facet: string,
  filters: Map<string, string[]>,
) {
  const others = filterSets(filters).filter(([f]) => f !== facet)
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = getRowStr(facet, row)
    if (key && others.every(([f, set]) => set.has(getRowStr(f, row)))) {
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  // a selected value stays listed, at 0, when no row shows it any more, so an
  // active filter never hides its own option
  for (const value of filters.get(facet) ?? []) {
    if (!counts.has(value)) {
      counts.set(value, 0)
    }
  }
  return counts
}
