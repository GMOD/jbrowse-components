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
 * Per-facet category counts for the filter sidebar. Active-filter facets are
 * counted first against the pre-filter row set (so their own counts reflect the
 * full set), then each active filter drills down the row set the later facets
 * are counted against.
 */
export function computeFacetCategoryCounts<T extends Row>(
  rows: T[],
  facets: string[],
  filters: Map<string, string[]>,
): Map<string, Map<string, number>> {
  const counts = new Map(
    facets.map(f => [f, new Map<string, number>()] as const),
  )
  const orderedFacets = [
    ...facets.filter(f => filters.get(f)?.length),
    ...facets.filter(f => !filters.get(f)?.length),
  ]
  let currentRows = rows
  for (const facet of orderedFacets) {
    const categoryCountMap = counts.get(facet)!
    for (const row of currentRows) {
      const key = getRowStr(facet, row)
      if (key) {
        categoryCountMap.set(key, (categoryCountMap.get(key) ?? 0) + 1)
      }
    }
    const filterValues = filters.get(facet)
    if (filterValues?.length) {
      const filterSet = new Set(filterValues)
      currentRows = currentRows.filter(row =>
        filterSet.has(getRowStr(facet, row)),
      )
    }
  }
  return counts
}
