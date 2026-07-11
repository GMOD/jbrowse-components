import { RefSequenceResult } from '@jbrowse/core/TextSearch/BaseResults'
import {
  UnknownRefNameError,
  dedupe,
  getEnv,
  getSession,
} from '@jbrowse/core/util'
import { isAlive } from '@jbrowse/mobx-state-tree'

import { parseLocStrings } from './LinearGenomeView/util.ts'

import type { LinearGenomeViewModel } from './LinearGenomeView/index.ts'
import type BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import type TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import type { SearchScope } from '@jbrowse/core/TextSearch/TextSearchManager'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { SearchType } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { AbstractSessionModel } from '@jbrowse/core/util'

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

// cap on refname suggestions surfaced from a query; the autocomplete only
// displays a bounded list, so there's no point collecting more
const MAX_REFNAME_HITS = 10

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
  // getLocation() can be an empty string when a result reports hasLocation()
  // but carries no coordinates; treat that as "no location" and fall back to
  // the label rather than forwarding '' into an empty, view-blanking parse
  const rawLocation = option.getLocation()
  const location = rawLocation ? rawLocation : option.getLabel()
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
  if (trackId && isAlive(model)) {
    model.showTrack(trackId)
  }

  const { pluginManager } = getEnv(session)
  await pluginManager.evaluateAsyncExtensionPoint(
    'LinearGenomeView-searchResultSelected',
    undefined,
    { session, result: option, model, assemblyName },
  )
}

// Thrown when a name search yields no hits and the input isn't coordinate-shaped.
// Typed (rather than a bare Error) so callers can render it as a soft "not found"
// warning instead of an error — string-matching the message would be brittle.
export class SearchResultsNotFoundError extends Error {
  name = 'SearchResultsNotFoundError'
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

    // the view may have been closed/detached while the text-search RPC ran
    if (!isAlive(model)) {
      return
    }
    if (results.length > 1) {
      model.setSearchResults(results, input.toLowerCase(), assemblyName)
    } else if (results.length === 1) {
      await navToOption({
        option: results[0]!,
        model,
        assemblyName,
      })
    } else {
      // no search hits: still try to resolve the input as a locstring (bare
      // refname, "ref start end" triplet, etc). if that also can't find a
      // refname AND the input is a single bare token (a plausible gene name),
      // reframe the unknown-ref error as a clean "no results" message; keep the
      // specific ref error for coordinate/multi-part queries
      try {
        await navToLocstrings()
      } catch (e) {
        const isPlainName = !input.includes(':') && !input.includes(' ')
        if (e instanceof UnknownRefNameError && isPlainName) {
          throw new SearchResultsNotFoundError(
            `No results found for "${input}"`,
          )
        } else {
          throw e
        }
      }
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
  // the dropdown shows the name that matches the FASTA / displayed regions.
  // allRefNames can hold ~10^6 entries, so stop once we have enough unique
  // canonical hits rather than lowercasing and scanning the entire list on
  // every keystroke
  const q = queryString.toLowerCase()
  const allRefNames = assembly?.allRefNames
  const canonicalHits = new Set<string>()
  if (assembly && allRefNames) {
    for (const ref of allRefNames) {
      const lower = ref.toLowerCase()
      const isMatch = searchType === 'exact' ? lower === q : lower.startsWith(q)
      if (isMatch) {
        canonicalHits.add(assembly.getCanonicalRefName(ref) ?? ref)
        if (canonicalHits.size >= MAX_REFNAME_HITS) {
          break
        }
      }
    }
  }
  const refNameResults = [...canonicalHits].map(
    r => new RefSequenceResult({ label: r, refName: r }),
  )

  return dedupe([...refNameResults, ...(textSearchResults ?? [])], elt =>
    elt.getId(),
  )
}

// splits on the last instance of a character
export function splitLast(str: string, split: string): [string, string] {
  const i = str.lastIndexOf(split)
  return i === -1 ? [str, ''] : [str.slice(0, i), str.slice(i + 1)]
}
