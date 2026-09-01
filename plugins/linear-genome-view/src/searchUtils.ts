import { RefSequenceResult } from '@jbrowse/core/TextSearch/BaseResults'
import {
  assembleLocString,
  dedupe,
  getEnv,
  getNotificationSink,
  getSession,
  matchRefNames,
  MAX_GLOB_REGIONS,
  parseLocString,
  UnknownRefNameError,
} from '@jbrowse/core/util'
import { isAlive } from '@jbrowse/mobx-state-tree'

import { parseLocStrings } from './LinearGenomeView/util.ts'

import type { LinearGenomeViewModel } from './LinearGenomeView/index.ts'
import type BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import type TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { SearchType } from '@jbrowse/core/data_adapters/BaseAdapter'
import type {
  AssemblyHost,
  NotificationSink,
  TrackCatalog,
} from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    // #region searchResultSelected
    'LinearGenomeView-searchResultSelected': {
      // nothing to accumulate: the point exists to react to the selection
      args: undefined
      result: undefined | Promise<void>
      props: {
        session: AssemblyHost & NotificationSink & TrackCatalog
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
    await showSearchResults({
      results: option.results,
      query: option.getLabel(),
      model,
      assemblyName,
    })
  } else {
    await handleSelectedRegion({
      input: option.getLabel(),
      assemblyName,
      model,
    })
  }
}

// Whether the view already has the track this hit came from on screen.
export function isOpenInView(result: BaseResult, model: LinearGenomeViewModel) {
  const trackId = result.getTrackId()
  return trackId !== undefined && !!model.getTrack(trackId)
}

// One spelling of a locstring, so two indexes that answer `chr1:1-100` and
// `1:1..100` are recognised as one place. An unparseable string is compared
// raw, which can only ever split a group that would otherwise have merged —
// the safe direction, since the picker is what an unprovable match falls back
// to.
function canonicalLocString(locString: string, assembly: Assembly) {
  try {
    const loc = parseLocString(locString, refName =>
      assembly.isValidRefName(refName),
    )
    return assembleLocString({
      ...loc,
      refName: assembly.getCanonicalRefName2(loc.refName),
    })
  } catch (e) {
    console.warn('failed to parse location string', locString, e)
    return locString
  }
}

// What a hit means as a destination: the name it shows and the place it goes.
// A hit with no location has no destination and can never join a group.
function destination(result: BaseResult, assembly?: Assembly) {
  const locString = result.getLocation()
  return locString
    ? [
        result.getDisplayString(),
        assembly?.initialized
          ? canonicalLocString(locString, assembly)
          : locString,
      ].join('\u0000')
    : undefined
}

// Which hit of an agreeing group to travel through, best rung first: a track
// the view already has on screen, then one the session could open if asked,
// then whatever the ranking put first. The middle rung is not hypothetical —
// a JBrowse 1 names index stores JBrowse 1 track *names*, and volvox's has
// four EDEN.1 entries of which two name nothing any JBrowse 2 config claims.
// Travelling through one of those navigates correctly and then drops a
// "could not resolve identifier" snackbar on top of it.
function trackRank(
  result: BaseResult,
  model: LinearGenomeViewModel,
  session: TrackCatalog,
) {
  const trackId = result.getTrackId()
  if (trackId === undefined) {
    return 2
  } else if (model.getTrack(trackId)) {
    return 0
  } else {
    return session.getTrackById(trackId) ? 1 : 3
  }
}

// The pick is a stable minimum, so a linear scan rather than a sort: only the
// best rung is taken, and keeping the first strictly-lowest one is what leaves
// an agreeing group with nothing to choose between in the order the ranking
// handed it. Ranked once per hit for the reason `destinations` above it is:
// `trackRank` reaches `session.getTrackById`, and a comparator asks O(n log n)
// times for an answer that does not vary.
function bestRanked(
  results: BaseResult[],
  model: LinearGenomeViewModel,
  session: TrackCatalog,
) {
  let best = results[0]!
  let bestRank = trackRank(best, model, session)
  for (let i = 1; i < results.length; i++) {
    const rank = trackRank(results[i]!, model, session)
    if (rank < bestRank) {
      best = results[i]!
      bestRank = rank
    }
  }
  return best
}

// The picker exists to disambiguate, and hits that name one feature at one
// place are not ambiguous — they are several indexes having found it. An
// instance carrying a handful of gene tracks turns every gene search into a
// table whose only varying column is Track, which is issues #4302 and #5068.
// When the hits agree there is nothing to ask, so navigate instead.
export function unanimousResult({
  results,
  model,
  session,
  assembly,
}: {
  results: BaseResult[]
  model: LinearGenomeViewModel
  session: TrackCatalog
  assembly?: Assembly
}) {
  // computed once per hit rather than once per comparison: a broad query can
  // carry a hundred results, and each one costs a locstring parse
  const destinations = results.map(r => destination(r, assembly))
  const agree =
    destinations[0] !== undefined &&
    destinations.every(d => d === destinations[0])
  return agree ? bestRanked(results, model, session) : undefined
}

// Every multi-hit result set reaches the picker through here, so the two
// search surfaces cannot disagree about when one is worth raising. Returns
// whether the view moved.
export async function showSearchResults({
  results,
  query,
  model,
  assemblyName,
  grow,
  showHitTrack,
}: {
  results: BaseResult[]
  query: string
  model: LinearGenomeViewModel
  assemblyName: string
  grow?: number
  showHitTrack?: boolean
}) {
  const session = getSession(model)
  const unanimous = unanimousResult({
    results,
    model,
    session,
    assembly: session.assemblyManager.get(assemblyName),
  })
  if (unanimous) {
    await navToOption({
      option: unanimous,
      model,
      assemblyName,
      grow,
      showHitTrack,
    })
    return true
  } else {
    model.setSearchResults(results, query, assemblyName)
    return false
  }
}

// A search hit lands with context around it rather than flush to the feature's
// own edges, which is what this default is; a caller that asked for a specific
// padding gets that instead.
const SEARCH_HIT_GROW = 0.2

// A hit lands with the track its index came from shown, which is what a name
// typed into the search box wants. A session spec that named its own tracks
// passes false: it asked for those tracks, and a hosted config's full RefSeq
// appearing beside the curated one it listed read as a bug.
export async function navToOption({
  option,
  model,
  assemblyName,
  grow,
  showHitTrack = true,
}: {
  model: LinearGenomeViewModel
  option: BaseResult
  assemblyName: string
  grow?: number
  showHitTrack?: boolean
}) {
  // getLocation() can be an empty string when a result reports hasLocation()
  // but carries no coordinates; treat that as "no location" and fall back to
  // the label rather than forwarding '' into an empty, view-blanking parse
  const location = option.getLocation() || option.getLabel()
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
  if (showHitTrack && trackId && isAlive(model)) {
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
export function notifySearchFailure(session: NotificationSink, e: unknown) {
  console.error(e)
  session.notify(
    e instanceof SearchResultsNotFoundError ? e.message : `${e}`,
    'warning',
  )
}

// if input is a known ref or locstring, navigate directly;
// otherwise search and: pop a dialog for multiple results, navigate for one,
// or fall back to treating input as a locstring
//
// Returns whether the view actually moved. Three branches deliberately do not
// navigate — a glob too wide to open, a multi-hit search whose hits disagree
// about where to go and so raise the picker, and a view detached while the
// search RPC ran — and each of them resolves, so a caller awaiting this cannot
// otherwise tell "showing it" from "asked you which one".
export async function handleSelectedRegion({
  input,
  model,
  assemblyName,
  grow,
  showHitTrack,
}: {
  input: string
  model: LinearGenomeViewModel
  assemblyName: string
  grow?: number
  showHitTrack?: boolean
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
    return true
  } else if (input.includes('*') && !!assembly) {
    // Enter does what the dropdown's "Show all N regions matching …" row does,
    // for the same text. It is NOT a blind resolution: that row, and the matches
    // under it, have been on screen the whole time the pattern was being typed,
    // which is the reason a glob belongs in the picker at all. What would be
    // indefensible is the two disagreeing — Enter reporting no results over a
    // list the box is showing is the same failure the exact-first search pass
    // was written to end, and a glob is precisely the query the text index can
    // never answer, since nothing PREFIX-matches the literal `chr*`.
    //
    // Ordered after the refName check, so a contig whose name really contains
    // `*` — GRCh38's HLA decoys — navigates to itself rather than being read as
    // a pattern. Same literal-first rule as selectNamedRegions.
    const names = matchRefNames(assembly, input, MAX_GLOB_REGIONS)
    if (names.length > MAX_GLOB_REGIONS) {
      // Refused rather than truncated, and said out loud. Opening the first
      // thousand of a wider match is the one outcome that would look like it
      // worked.
      getNotificationSink(model).notify(
        `"${input}" matches more than ${MAX_GLOB_REGIONS} regions — narrow the pattern`,
        'warning',
      )
      return false
    } else if (names.length) {
      await model.navToLocations(
        parseLocStrings(names.join(' '), assemblyName, (ref, asm) =>
          assemblyManager.isValidRefName(ref, asm),
        ),
        assemblyName,
      )
      return true
    } else {
      // matched nothing: a pattern is not a feature name, so there is no index
      // to fall through to, and the miss is the whole answer
      throw new SearchResultsNotFoundError(`No results found for "${input}"`)
    }
  } else {
    // Ask once, unrestricted, and read exactness off the hits. Prefer the
    // exact ones so a precise name navigates straight to its feature instead
    // of opening a picker of everything it prefixes ("EDEN" must not pop a
    // dialog for EDEN.1/.2/.3) — but an exact miss is not a no-result, since
    // the autocomplete dropdown searched unrestricted and anything it just
    // listed has to be reachable here too (typing "apple" and pressing enter
    // once reported `No results found for "apple"` for a query the dropdown
    // had two hits for).
    //
    // This used to be two searches, an exact one and then a broad one on the
    // miss, which is two reads of the same index for the same query — the
    // adapters answer 'exact' by filtering exactly this list. An adapter that
    // tags nothing simply never wins the exact pass, which is the behaviour it
    // had when it returned nothing for searchType: 'exact'.
    const allResults = await fetchResults({
      queryString: input,
      assemblyName,
      textSearchManager,
      assembly,
    })
    const exactResults = allResults.filter(r => r.isExact())
    const results = exactResults.length ? exactResults : allResults

    // the view may have been closed/detached while the text-search RPC ran
    if (!isAlive(model)) {
      return false
    }
    if (results.length > 1) {
      return await showSearchResults({
        results,
        query: input,
        model,
        assemblyName,
        grow,
        showHitTrack,
      })
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
        showHitTrack,
      })
      return true
    } else {
      // no search hits: still try to resolve the input as a locstring (bare
      // refname, "ref start end" triplet, etc). if that also can't find a
      // refname AND the input is a single bare token (a plausible gene name),
      // reframe the unknown-ref error as a clean "no results" message; keep the
      // specific ref error for coordinate/multi-part queries
      try {
        await navToLocstrings()
        return true
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
  // canonical name -> whether any alias of it matched the query exactly, so
  // "contigb" is an exact hit on ctgB even though the canonical name is not
  // the query. Same collapsing as before, now carrying the flag through it
  const canonicalHits = new Map<string, boolean>()
  for (const ref of assembly.allRefNames ?? []) {
    const lower = ref.toLowerCase()
    const exact = lower === q
    const isMatch = searchType === 'exact' ? exact : lower.startsWith(q)
    if (isMatch) {
      const canonical = assembly.getCanonicalRefName2(ref)
      canonicalHits.set(canonical, exact || !!canonicalHits.get(canonical))
      if (canonicalHits.size >= MAX_REFNAME_HITS) {
        break
      }
    }
  }
  return [...canonicalHits].map(
    ([r, exact]) => new RefSequenceResult({ label: r, refName: r, exact }),
  )
}

// splits on the last instance of a character
export function splitLast(str: string, split: string): [string, string] {
  const i = str.lastIndexOf(split)
  return i === -1 ? [str, ''] : [str.slice(0, i), str.slice(i + 1)]
}
