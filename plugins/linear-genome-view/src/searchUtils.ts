import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { getSession, dedupe } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from './LinearGenomeView'
import type { SearchScope } from '@jbrowse/core/TextSearch/TextSearchManager'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { SearchType } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { TextSearchManager } from '@jbrowse/core/util'

// locals

export async function navToOption({
  option,
  model,
  assemblyName,
}: {
  model: LinearGenomeViewModel
  option: BaseResult
  assemblyName: string
}) {
  const location = option.getLocation()
  const trackId = option.getTrackId()
  if (location) {
    await model.navToLocString(location, assemblyName)
    if (trackId) {
      model.showTrack(trackId)
    }
  }
}

// gets a string as input, or use stored option results from previous query,
// then re-query and
// 1) if it has multiple results: pop a dialog
// 2) if it's a single result navigate to it
// 3) else assume it's a locstring and navigate to it
export async function handleSelectedRegion({
  input,
  model,
  assembly,
}: {
  input: string
  model: LinearGenomeViewModel
  assembly: Assembly
}) {
  const allRefs = assembly.allRefNamesWithLowerCase || []
  const assemblyName = assembly.name
  if (input.split(' ').every(entry => checkRef(entry, allRefs))) {
    await model.navToLocString(input, assembly.name)
  } else {
    const searchScope = model.searchScope(assemblyName)
    const { textSearchManager } = getSession(model)
    const results = await fetchResults({
      queryString: input,
      searchType: 'exact',
      searchScope,
      rankSearchResults: model.rankSearchResults,
      textSearchManager,
      assembly,
    })

    if (results.length > 1) {
      model.setSearchResults(results, input.toLowerCase(), assemblyName)
    } else if (results.length === 1) {
      await navToOption({
        option: results[0]!,
        model,
        assemblyName,
      })
    } else {
      await model.navToLocString(input, assemblyName)
    }
  }
}

export function checkRef(str: string, allRefs: string[]) {
  const [ref, rest] = splitLast(str, ':')
  return (
    allRefs.includes(str) ||
    (allRefs.includes(ref) && !Number.isNaN(Number.parseInt(rest, 10)))
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
  }
  const before = str.slice(0, lastIndex)
  const after = str.slice(lastIndex + 1)
  return [before, after]
}
