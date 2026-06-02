import { RefSequenceResult } from '@jbrowse/core/TextSearch/BaseResults'
import { dedupe, getEnv, getSession } from '@jbrowse/core/util'

import { parseLocStrings } from './LinearGenomeView/util.ts'

import type { LinearGenomeViewModel } from './LinearGenomeView/index.ts'
import type BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import type { SearchScope } from '@jbrowse/core/TextSearch/TextSearchManager'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { SearchType } from '@jbrowse/core/data_adapters/BaseAdapter'
import type {
  AbstractSessionModel,
  TextSearchManager,
} from '@jbrowse/core/util'

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'LinearGenomeView-searchResultSelected': {
      args: undefined
      result: undefined
      props: {
        session: AbstractSessionModel
        result: BaseResult
        model: LinearGenomeViewModel
        assemblyName: string
      }
    }
  }
}

// shared dispatch used by SearchBox.onSelect and the LGV ImportForm submit:
// route a chosen result to a direct nav, a multi-result dialog, or a generic
// locstring/refname resolution
export async function navigateToSelectedOption({
  option,
  model,
  assemblyName,
}: {
  option: BaseResult
  model: LinearGenomeViewModel
  assemblyName: string
}) {
  if (option.hasLocation()) {
    await navToOption({ option, model, assemblyName })
  } else if (option.results?.length) {
    model.setSearchResults(option.results, option.getLabel(), assemblyName)
  } else {
    await handleSelectedRegion({
      input: option.getLabel(),
      assemblyName,
      model,
    })
  }
}

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

  // navigate treating input as one or more whitespace-separated locstrings
  const navToLocstrings = () =>
    model.navToLocations(
      parseLocStrings(input, assemblyName, (ref, asm) =>
        assemblyManager.isValidRefName(ref, asm),
      ),
      assemblyName,
      grow,
    )

  if (allRefs && input.split(' ').every(entry => checkRef(entry, allRefs))) {
    await navToLocstrings()
  } else {
    const searchScope = model.searchScope(assemblyName)
    const results = await fetchResults({
      queryString: input,
      searchType: 'exact',
      searchScope,
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
      await navToLocstrings()
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
  textSearchManager,
  assembly,
}: {
  queryString: string
  searchScope: SearchScope
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
  )

  // ensure aliases are loaded: the getters below are pure, so reading
  // allRefNames does not itself kick off the lazy load
  await assembly?.load()

  // resolve aliases (e.g. 'contigB') to the canonical refname ('ctgB') so
  // the dropdown shows the name that matches the FASTA / displayed regions
  const q = queryString.toLowerCase()
  const refNameResults = [
    ...new Set(
      assembly?.allRefNames
        ?.filter(ref =>
          searchType === 'exact'
            ? ref.toLowerCase() === q
            : ref.toLowerCase().startsWith(q),
        )
        .map(ref => assembly.getCanonicalRefName(ref) ?? ref),
    ),
  ]
    .slice(0, 10)
    .map(r => new RefSequenceResult({ label: r, refName: r }))

  return dedupe([...refNameResults, ...(textSearchResults ?? [])], elt =>
    elt.getId(),
  )
}

// splits on the last instance of a character
export function splitLast(str: string, split: string): [string, string] {
  const i = str.lastIndexOf(split)
  return i === -1 ? [str, ''] : [str.slice(0, i), str.slice(i + 1)]
}
