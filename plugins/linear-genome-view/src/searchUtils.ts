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
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { SearchType } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    // #region searchResultSelected
    'LinearGenomeView-searchResultSelected': {
      // nothing to accumulate: the point exists to react to the selection
      args: undefined
      result: undefined | Promise<void>
      props: {
        session: AbstractSessionModel
        /** the search result that was selected */
        result: BaseResult
        model: LinearGenomeViewModel
        assemblyName: string
      }
    }
    // #endregion
  }
}

// Budget for refName suggestions from a query. Deliberately far below the
// autocomplete's ~100-row display cap: refNames are returned ahead of the text
// search hits, so a scaffold-heavy assembly would otherwise fill every row with
// scaffolds and push the gene hits out of the list entirely. Raising this to
// match the display cap looks like a consistency fix and is not one.
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

// A search hit lands with context around it rather than flush to the feature's
// own edges, which is what this default is; a caller that asked for a specific
// padding gets that instead.
const SEARCH_HIT_GROW = 0.2

export async function navToOption({
  option,
  model,
  assemblyName,
  grow,
}: {
  model: LinearGenomeViewModel
  option: BaseResult
  assemblyName: string
  grow?: number
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
    grow ?? SEARCH_HIT_GROW,
  )
  if (trackId && isAlive(model)) {
    model.showTrack(trackId)
  }

  // same detach hazard as showTrack above: navToLocations awaits, and handlers
  // read off the view (the canvas one calls getSession(model) and model.tracks),
  // which throws once it has left the tree. Deliberately not the Strict runner —
  // this fires after the navigation has already succeeded, so a plugin's
  // post-nav side effect failing must not turn a completed search into an error
  if (isAlive(model)) {
    const { pluginManager } = getEnv(session)
    await pluginManager.evaluateAsyncExtensionPoint(
      /** #extensionPoint LinearGenomeView-searchResultSelected | async | Invoked when a search result is selected */
      'LinearGenomeView-searchResultSelected',
      undefined,
      { session, result: option, model, assemblyName },
    )
  }
}

// Thrown when a name search yields no hits and the input isn't coordinate-shaped.
// Typed (rather than a bare Error) so callers can render it as a soft "not found"
// warning instead of an error — string-matching the message would be brittle.
export class SearchResultsNotFoundError extends Error {
  name = 'SearchResultsNotFoundError'
}

// How every search surface reports a failed navigation. A miss is the ordinary
// outcome of typing a name that isn't there, so it shows its own sentence
// rather than `${e}`, which would prefix it with the class name. Shared so the
// import form and the header box can't drift apart on it again.
export function notifySearchFailure(session: AbstractSessionModel, e: unknown) {
  console.error(e)
  session.notify(
    e instanceof SearchResultsNotFoundError ? e.message : `${e}`,
    'warning',
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
  // resolves only once regions/aliases are loaded, which isValidRefName needs
  // (it throws otherwise). A load failure is not this function's to report:
  // swallow it and let the input fall through to the text-search path below
  // rather than surfacing as a nav error
  const assembly = await assemblyManager
    .waitForAssembly(assemblyName)
    .catch(() => undefined)
  // the same predicate navToLocstrings hands parseLocStrings, so a locstring
  // that passes here is one the parse below will accept
  const isRef = (ref: string) =>
    !!assembly && assemblyManager.isValidRefName(ref, assemblyName)

  // navigate treating input as one or more whitespace-separated locstrings
  const navToLocstrings = () =>
    model.navToLocations(
      parseLocStrings(input, assemblyName, (ref, asm) =>
        assemblyManager.isValidRefName(ref, asm),
      ),
      assemblyName,
      grow,
    )

  if (
    input
      .split(/\s+/)
      .filter(Boolean)
      .every(entry => checkRef(entry, isRef))
  ) {
    await navToLocstrings()
  } else {
    const search = (searchType: SearchType | undefined) =>
      fetchResults({
        queryString: input,
        searchType,
        assemblyName,
        textSearchManager,
        assembly,
      })

    // Exact first, so a precise name navigates straight to its feature instead
    // of opening a picker of everything it prefixes ("EDEN" must not pop a
    // dialog for EDEN.1/.2/.3). But an exact miss is not a no-result: the
    // autocomplete dropdown searched unrestricted, so anything it just listed
    // has to be reachable here too. Without the retry, typing a name the
    // dropdown had hits for (e.g. "apple" -> Apple2, Apple3) and pressing
    // enter reported `No results found for "apple"`.
    const exactResults = await search('exact')
    const results = exactResults.length ? exactResults : await search(undefined)

    // the view may have been closed/detached while the text-search RPC ran
    if (!isAlive(model)) {
      return
    }
    if (results.length > 1) {
      model.setSearchResults(results, input, assemblyName)
    } else if (results.length === 1) {
      // `grow` reached the locstring branch above but not this one, so a
      // caller's padding — a session spec's `grow`, sv-core's navToLoc — was
      // honoured or silently replaced by 0.2 depending on whether the input
      // happened to parse as a locstring rather than resolve to a feature
      await navToOption({
        option: results[0]!,
        model,
        assemblyName,
        grow,
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

export function checkRef(str: string, isRef: (name: string) => boolean) {
  const [ref, rest] = splitLast(str, ':')
  return isRef(str) || (isRef(ref) && /^\d/.test(rest))
}

export async function fetchResults({
  queryString,
  searchType,
  assemblyName,
  textSearchManager,
  assembly,
  stopToken,
}: {
  queryString: string
  assemblyName: string
  searchType?: SearchType
  textSearchManager?: TextSearchManager
  assembly?: Assembly
  // supplied by the autocomplete's per-fetch token, so a keystroke that
  // supersedes this one drops the ranking and formatting rather than finishing
  // an answer that is already stale
  stopToken?: StopToken
}) {
  const textSearchResults = await textSearchManager?.search(
    {
      queryString,
      searchType,
      stopToken,
    },
    assemblyName,
  )

  // ensure aliases are loaded: allRefNames is a pure getter, so reading it does
  // not itself kick off the lazy load. A load failure just leaves allRefNames
  // undefined, so this still returns whatever the text search turned up
  await assembly?.load().catch(() => {})
  const refNameResults = assembly
    ? searchRefNames(assembly, queryString, searchType)
    : []

  return dedupe([...refNameResults, ...(textSearchResults ?? [])], elt =>
    elt.getId(),
  )
}

// Scan assembly refnames for query matches, resolving aliases (e.g. 'contigB')
// to the canonical refname ('ctgB') so the dropdown shows the name that matches
// the FASTA / displayed regions. allRefNames can hold ~10^6 entries, so stop
// once enough unique canonical hits accumulate rather than lowercasing and
// scanning the entire list on every keystroke.
function searchRefNames(
  assembly: Assembly,
  queryString: string,
  searchType?: SearchType,
) {
  const q = queryString.toLowerCase()
  const canonicalHits = new Set<string>()
  for (const ref of assembly.allRefNames ?? []) {
    const lower = ref.toLowerCase()
    const isMatch = searchType === 'exact' ? lower === q : lower.startsWith(q)
    if (isMatch) {
      canonicalHits.add(assembly.getCanonicalRefName(ref) ?? ref)
      if (canonicalHits.size >= MAX_REFNAME_HITS) {
        break
      }
    }
  }
  return [...canonicalHits].map(
    r => new RefSequenceResult({ label: r, refName: r }),
  )
}

// splits on the last instance of a character
export function splitLast(str: string, split: string): [string, string] {
  const i = str.lastIndexOf(split)
  return i === -1 ? [str, ''] : [str.slice(0, i), str.slice(i + 1)]
}
