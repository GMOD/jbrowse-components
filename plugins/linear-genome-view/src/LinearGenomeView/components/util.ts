import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { dedupe } from '@jbrowse/core/util'
import type { SearchScope } from '@jbrowse/core/TextSearch/TextSearchManager'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { SearchType } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { TextSearchManager } from '@jbrowse/core/util'

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

export function getRelativeX(
  event: { clientX: number; target: EventTarget | null },
  element: HTMLElement | null,
) {
  return event.clientX - (element?.getBoundingClientRect().left || 0)
}

export function getCytobands(assembly: Assembly | undefined, refName: string) {
  return (
    assembly?.cytobands
      ?.map(f => ({
        refName:
          assembly.getCanonicalRefName(f.get('refName')) || f.get('refName'),
        start: f.get('start'),
        end: f.get('end'),
        type: f.get('gieStain') as string,
      }))
      .filter(f => f.refName === refName) || []
  )
}
