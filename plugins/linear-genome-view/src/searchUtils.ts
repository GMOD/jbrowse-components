import { filterRefNames } from '@jbrowse/core/TextSearch/fetchResults'
import { dedupe, getEnv, getSession } from '@jbrowse/core/util'

import { parseLocStrings } from './LinearGenomeView/util.ts'

import type { LinearGenomeViewModel } from './LinearGenomeView/index.ts'
import type BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import type { SearchScope } from '@jbrowse/core/TextSearch/TextSearchManager'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { SearchType } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { TextSearchManager } from '@jbrowse/core/util'

export async function navToOption({
  option,
  model,
  assemblyName,
}: {
  model: LinearGenomeViewModel
  option: BaseResult
  assemblyName: string
}) {
  const location = option.getLocation() ?? option.getLabel()
  const trackId = option.getTrackId()
  const session = getSession(model)
  const { assemblyManager } = session
  await model.navToLocations(
    parseLocStrings(location, assemblyName, (ref, asm) =>
      assemblyManager.isValidRefName(ref, asm),
    ),
    assemblyName,
    0.2,
  )
  if (trackId) {
    model.showTrack(trackId)
  }

  const { pluginManager } = getEnv(session)
  await pluginManager.evaluateAsyncExtensionPoint(
    'LinearGenomeView-searchResultSelected',
    undefined,
    { session, result: option, model, assemblyName },
  )
}

// if input is a known ref or locstring, navigate directly;
// otherwise search and: pop a dialog for multiple results, navigate for one,
// or fall back to treating input as a locstring
export async function handleSelectedRegion({
  input,
  model,
  assemblyName,
  grow,
}: {
  input: string
  model: LinearGenomeViewModel
  assemblyName: string
  grow?: number
}) {
  const { assemblyManager, textSearchManager } = getSession(model)
  const assembly = assemblyManager.get(assemblyName)
  const allRefs = assembly?.allRefNamesWithLowerCase

  if (allRefs && input.split(' ').every(entry => checkRef(entry, allRefs))) {
    await model.navToLocations(
      parseLocStrings(
        input,
        assemblyName,
        ref => allRefs.has(ref) || allRefs.has(ref.toLowerCase()),
      ),
      assemblyName,
      grow,
    )
  } else {
    const searchScope = model.searchScope(assemblyName)
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
      await model.navToLocations(
        parseLocStrings(input, assemblyName, (ref, asm) =>
          assemblyManager.isValidRefName(ref, asm),
        ),
        assemblyName,
        grow,
      )
    }
  }
}

export function checkRef(str: string, allRefs: Set<string>) {
  const [ref, rest] = splitLast(str, ':')
  return allRefs.has(str) || (allRefs.has(ref) && /^\d/.test(rest))
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
  const textSearchResults = await textSearchManager?.search(
    {
      queryString,
      searchType,
    },
    searchScope,
    rankSearchResults,
  )

  const refNameResults = filterRefNames(
    assembly?.allRefNames,
    queryString,
    searchType,
  )

  return dedupe([...refNameResults, ...(textSearchResults ?? [])], elt =>
    elt.getId(),
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
