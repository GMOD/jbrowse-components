import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

export interface QueryHits {
  query: string
  hits: SimpleFeatureSerialized[]
}

function queryOf(feature: SimpleFeatureSerialized) {
  return typeof feature.queryName === 'string' ? feature.queryName : ''
}

/**
 * The hits under the query each came from, in the order the queries were
 * submitted, so a record that found nothing still gets its row. A hit naming a
 * query that was not submitted (a server renaming a record) gets a group of
 * its own after them rather than being dropped. Hits keep their best-first
 * order within a group.
 */
export function groupHitsByQuery(
  features: SimpleFeatureSerialized[],
  queries: string[],
): QueryHits[] {
  const names = [...new Set([...queries, ...features.map(queryOf)])]
  return names.map(query => ({
    query,
    hits: features.filter(feature => queryOf(feature) === query),
  }))
}
