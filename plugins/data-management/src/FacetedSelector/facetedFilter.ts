import { getRowStr } from './components/util.ts'

import type { Row } from './components/util.ts'

/**
 * Free-text filter over a row's name, category, description, and every metadata
 * value. Case-insensitive substring match; an empty query returns all rows.
 */
export function filterRowsByText<T extends Row>(rows: T[], query: string): T[] {
  const q = query.toLowerCase()
  if (!q) {
    return rows
  }
  return rows.filter(
    row =>
      `${row.name ?? ''}`.toLowerCase().includes(q) ||
      `${row.category ?? ''}`.toLowerCase().includes(q) ||
      `${row.description ?? ''}`.toLowerCase().includes(q) ||
      Object.values(row.metadata ?? {}).some(
        v => v != null && `${v}`.toLowerCase().includes(q),
      ),
  )
}

/**
 * Keeps rows whose value for each actively-filtered facet is one of the
 * selected values. Facets with no selection don't constrain anything.
 */
export function filterRowsByFacets<T extends Row>(
  rows: T[],
  filters: Map<string, string[]>,
): T[] {
  const active = [...filters.entries()]
    .filter(([, vals]) => vals.length > 0)
    .map(([key, vals]) => [key, new Set(vals)] as const)
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
  const activeFilters = facets
    .map(f => [f, filters.get(f)] as const)
    .filter(([, vals]) => vals?.length)
    .map(([f, vals]) => [f, new Set(vals)] as const)
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
