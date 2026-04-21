import BaseResult from './BaseResults.ts'
import { dedupe } from '../util/index.ts'

import type { SearchType } from '../data_adapters/BaseAdapter/types.ts'
import type { AbstractSessionModel } from '../util/index.ts'

/**
 * Session-aware search that combines refname prefix matches with text-search
 * hits from aggregate indexes configured on tracks. Returned by
 * `RefNameAutocomplete`'s `fetchResults` prop in views that don't already
 * have a view-level scope (LGV keeps its own variant because its scope is
 * the view's open tracks).
 */
export async function fetchResults({
  queryString,
  session,
  assemblyName,
  searchType,
  rankSearchResults = r => r,
}: {
  queryString: string
  session: AbstractSessionModel
  assemblyName: string
  searchType?: SearchType
  rankSearchResults?: (results: BaseResult[]) => BaseResult[]
}) {
  const { textSearchManager, assemblyManager } = session
  const textResults =
    (await textSearchManager?.search(
      { queryString, searchType },
      { assemblyName, includeAggregateIndexes: true },
      rankSearchResults,
    )) ?? []

  const q = queryString.toLowerCase()
  const assembly = assemblyManager.get(assemblyName)
  const refNameResults =
    assembly?.allRefNames
      ?.filter(ref =>
        searchType === 'exact'
          ? ref.toLowerCase() === q
          : ref.toLowerCase().startsWith(q),
      )
      .slice(0, 10)
      .map(r => new BaseResult({ label: r })) ?? []

  return dedupe([...refNameResults, ...textResults], elt => elt.getId())
}
