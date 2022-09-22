import { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { SearchType } from '@jbrowse/core/data_adapters/BaseAdapter'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { SearchScope } from '@jbrowse/core/TextSearch/TextSearchManager'
import { TextSearchManager } from '@jbrowse/core/util'

export function dedupe(
  results: BaseResult[] = [],
  cb: (result: BaseResult) => string,
) {
  return results.filter(
    (elt, idx, self) => idx === self.findIndex(t => cb(t) === cb(elt)),
  )
}

export async function fetchResults({
  queryString,
  searchType,
  searchScope,
  rankSearchResults,
  textSearchManager,
  assembly,
}: {
  queryString: string
  searchScope: SearchScope
  rankSearchResults: (results: BaseResult[]) => BaseResult[]
  searchType?: SearchType
  textSearchManager?: TextSearchManager
  assembly?: Assembly
}) {
  if (!textSearchManager) {
    console.warn('No text search manager')
  }

  const textSearchResults = await textSearchManager?.search(
    {
      queryString,
      searchType,
    },
    searchScope,
    rankSearchResults,
  )

  const refNameResults = assembly?.allRefNames
    ?.filter(ref => ref.toLowerCase().startsWith(queryString.toLowerCase()))
    .slice(0, 10)
    .map(r => new BaseResult({ label: r }))

  return dedupe(
    [...(refNameResults || []), ...(textSearchResults || [])],
    elt => elt.getId(),
  )
}

// splits on the last instance of a character
export function splitLast(str: string, split: string): [string, string] {
  const lastIndex = str.lastIndexOf(split)
  if (lastIndex === -1) {
    return [str, '']
  } else {
    const before = str.slice(0, lastIndex)
    const after = str.slice(lastIndex + 1)
    return [before, after]
  }
}
