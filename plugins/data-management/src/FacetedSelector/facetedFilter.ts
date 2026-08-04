import { buildSearchText } from '../shared/searchText.ts'
import { getRowStr } from './components/util.ts'

import type { Row } from './components/util.ts'

/**
 * The text a free-text query matches a row against: every column the grid
 * renders — name, category, adapter, description and each metadata value —
 * normalized by buildSearchText, which the tree's rows go through too. Built
 * once per row in allRows (mirroring the tree's trackNodeSourceFor) so a
 * keystroke neither re-reads configs nor re-strips HTML.
 */
export function rowSearchText(row: {
  name: string
  category?: string
  adapter?: string
  description?: string
  metadata: Record<string, unknown>
}) {
  return buildSearchText([
    row.name,
    row.category,
    row.adapter,
    row.description,
    ...Object.values(row.metadata),
  ])
}

// The facets with a non-empty selection, each as a lookup set. Facets with no
// selection are dropped since they don't constrain anything.
function activeFilterSets(filters: Map<string, string[]>) {
  return [...filters.entries()]
    .filter(([, vals]) => vals.length > 0)
    .map(([key, vals]) => [key, new Set(vals)] as const)
}

/**
 * Free-text filter against each row's precomputed searchText. Case-insensitive
 * substring match; an empty query returns the same rows array.
 */
export function filterRowsByText<T extends { searchText: string }>(
  rows: T[],
  query: string,
): T[] {
  const q = query.toLowerCase()
  return q ? rows.filter(row => row.searchText.includes(q)) : rows
}

/**
 * Keeps rows whose value for each actively-filtered facet is one of the
 * selected values. Facets with no selection don't constrain anything.
 */
export function filterRowsByFacets<T extends Row>(
  rows: T[],
  filters: Map<string, string[]>,
): T[] {
  const active = activeFilterSets(filters)
  return rows.filter(row =>
    active.every(([key, set]) => set.has(getRowStr(key, row))),
  )
}

/**
 * Per-facet category counts for the filter sidebar. Each facet is counted over
 * the rows that pass every *other* active facet, but not its own selection, so
 * its options keep showing the counts you'd get by switching to them. This is
 * order-independent: a facet's counts reflect all other active filters
 * regardless of column order.
 */
export function computeFacetCategoryCounts<T extends Row>(
  rows: T[],
  facets: string[],
  filters: Map<string, string[]>,
): Map<string, Map<string, number>> {
  // Honor every active filter (matching filterRowsByFacets), not just those in
  // `facets` — a filter on a column that has dropped out of `facets` (e.g. gone
  // sparse) still constrains the grid, so it must constrain these counts too.
  const activeFilters = activeFilterSets(filters)
  return new Map(
    facets.map(facet => {
      const categoryCountMap = new Map<string, number>()
      for (const row of rows) {
        const passesOthers = activeFilters.every(
          ([f, set]) => f === facet || set.has(getRowStr(f, row)),
        )
        const key = getRowStr(facet, row)
        if (passesOthers && key) {
          categoryCountMap.set(key, (categoryCountMap.get(key) ?? 0) + 1)
        }
      }
      return [facet, categoryCountMap] as const
    }),
  )
}
