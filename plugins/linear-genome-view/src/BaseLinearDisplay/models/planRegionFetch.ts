import type { Region } from '@jbrowse/core/util'

/** A region paired with the index that joins it to the display's data map. */
export interface IndexedRegion {
  region: Region
  displayedRegionIndex: number
}

/** The fields `planRegionFetch` reads off a `view.visibleRegions` block. */
export interface VisibleBlock {
  refName: string
  start: number
  end: number
  assemblyName: string
  displayedRegionIndex: number
}

/**
 * True when the loaded region fully contains the visible `block`: same refName
 * and the integer-rounded block bounds lie within the loaded extent.
 * `Math.floor`/`Math.ceil` handle fractional bpPerPx where block edges fall on
 * non-integer genomic positions. Single source of truth for "is this block
 * already fetched" — shared by `planRegionFetch` (deciding what to refetch) and
 * the `viewportWithinLoadedData` getter (deciding whether the on-screen data is
 * stale).
 */
export function isBlockCovered(
  loaded: Region | undefined,
  block: { refName: string; start: number; end: number },
) {
  return (
    loaded?.refName === block.refName &&
    Math.floor(block.start) >= loaded.start &&
    Math.ceil(block.end) <= loaded.end
  )
}

/**
 * Everything the plan needs once the cheap bail-outs are past: the track's
 * assemblies, the two region lists, and the two per-region lookups.
 */
export interface RegionFetchSources {
  /** the assemblies the containing track declares */
  trackAssemblyNames: string[]
  /** whether a track assembly knows `regionAssemblyName` as an alias */
  hasAssemblyName: (
    trackAssemblyName: string,
    regionAssemblyName: string,
  ) => boolean
  /** what is on screen — the blocks the plan judges */
  visibleRegions: VisibleBlock[]
  /**
   * what a fetch would actually pull: `visibleRegions` widened by a half-screen
   * each side. The plan judges the visible block and fetches the buffered one,
   * which is the whole reason both lists are here. Returning the visible block
   * instead compiles, draws correctly, and silently deletes the prefetch buffer
   * that keeps a pan from blanking.
   */
  bufferedVisibleRegions: IndexedRegion[]
  /** the region already loaded at this index, if any */
  loadedRegion: (displayedRegionIndex: number) => Region | undefined
  /** the display's `isCacheValid` hook — content staleness, not spatial */
  isCacheValid: (displayedRegionIndex: number) => boolean
}

export interface RegionFetchInputs {
  /** a fetch failed, or the user canceled one */
  error: unknown
  fetchCanceled: boolean
  /**
   * `RegionTooLargeMixin`'s: the gate says too large AND it measured that at
   * this very viewport, so there is nothing left to learn here. One getter
   * rather than the two terms, because the global family's skip is the same
   * question and a guard kept in two copies is where an escape clause gets
   * added to one of them.
   */
  gateSkipsMeasuredViewport: boolean
  /**
   * A fetch is in flight. A **thunk**, and untracked at the call site: tracking
   * it would re-fire the autorun on the `isLoading` flip mid-fetch, when
   * `fetchGeneration` at fetch end is the real re-trigger.
   */
  isLoading: () => boolean
  /**
   * The containing track is minimized. A **thunk** so a minimized track does
   * not also subscribe to the viewport through {@link sources} — with several
   * minimized tracks that is one wasted autorun run each, per pan. Tracked, so
   * un-minimizing re-fires the autorun and the fetch resumes.
   */
  minimized: () => boolean
  /**
   * A **thunk** for the reason `computeDisplayPhase`'s `loading` is one: it
   * reads the containing view (`visibleRegions`, `bufferedVisibleRegions`), a
   * large reactive dependency set, and a run that bails above it must not
   * subscribe to all of it.
   */
  sources: () => RegionFetchSources
}

/** Why the plan decided to fetch nothing. */
export type RegionFetchIdleReason =
  /** a fetch failed or was canceled; only a viewport change clears it */
  | 'blocked'
  /** the gate says too large, and it measured that at this very viewport */
  | 'measured'
  | 'inFlight'
  | 'minimized'
  /** every visible block is loaded and its cache is still valid */
  | 'covered'

export type RegionFetchPlan =
  | { kind: 'idle'; reason: RegionFetchIdleReason }
  | {
      kind: 'assemblyMismatch'
      regionAssemblyName: string
      trackAssemblyNames: string[]
    }
  | { kind: 'fetch'; needed: IndexedRegion[] }

/** The banner text for an `assemblyMismatch` plan. */
export function regionAssemblyMismatchMessage({
  regionAssemblyName,
  trackAssemblyNames,
}: {
  regionAssemblyName: string
  trackAssemblyNames: string[]
}) {
  return `region assembly (${regionAssemblyName}) does not match track assemblies (${trackAssemblyNames})`
}

/**
 * How `makeRetryContractCheck` should read this plan — did the run answer an
 * outstanding `reload()`, and how?
 *
 * The mapping lives here, beside the reasons, because each answer is a property
 * of *why* the run stopped rather than of where in the autorun it stopped. It
 * was seven `noteFetchAutorunRun(...)` calls down the body, which is seven
 * places for a new early return to forget one — and forgetting is silent, since
 * an unconsumed bump reports against whichever unrelated run consumes it later.
 *
 * - **`gated`** — the user is looking at something that answers the click: an
 *   error bar, a canceled load, the too-large banner's Force load, a new
 *   assembly-mismatch error. A minimized track has nothing on screen to click,
 *   so its run consumes the bump too and un-minimizing is judged on its own.
 * - **`deferred`** — a fetch is already running. `reload()` signals the running
 *   fetch's stop token but `activeStopToken` clears in `runFetch`'s `finally`,
 *   so the run right after a retry can still land here; that fetch ending bumps
 *   `fetchGeneration` and re-runs the body. Consuming would answer the retry
 *   with a run that predates it.
 * - **`declined`** — every visible block was already covered, so the run
 *   reached no fetch. After a `reload()` that is the dead button: the base
 *   clears `loadedRegions`, so an override landing here invalidated nothing.
 *
 * A `fetch` plan is deliberately absent: reaching `fetchNeeded` is not the same
 * as reaching `fetchRegions`, and only the funnel flag can tell those apart.
 */
export function retryOutcomeForPlan(
  plan: RegionFetchPlan,
): 'gated' | 'deferred' | 'declined' | undefined {
  if (plan.kind === 'assemblyMismatch') {
    return 'gated'
  }
  if (plan.kind === 'fetch') {
    return undefined
  }
  switch (plan.reason) {
    case 'inFlight':
      return 'deferred'
    case 'covered':
      return 'declined'
    default:
      return 'gated'
  }
}

/**
 * What the per-region fetch autorun should do right now, as a value: fetch this
 * region set, raise this assembly mismatch, or do nothing for this reason.
 *
 * Pure, so the precedence between the five idle reasons and the buffered-region
 * substitution are testable without an MST tree, a view, or a mocked RPC. What
 * it deliberately does **not** decide is the MobX dependency set — which reads
 * are tracked is a property of the autorun body, expressed here only as which
 * inputs are thunks. `installPerRegionFetchAutoruns.test.ts` is what pins that
 * half; this function cannot.
 *
 * **A blocked gate skips the fetch it has already measured, not every fetch.**
 * Skipping unconditionally is what used to freeze the estimate at the viewport
 * it was captured over, leaving the banner to be released by arithmetic instead
 * (`RegionTooLargeMixin` §"Measurement follows the viewport"). Letting it run
 * unconditionally would spin instead: a too-large region stores nothing, so it
 * stays in `needed`, and the `fetchGeneration` bump after each attempt re-fires
 * the autorun. So it runs once per settled viewport while blocked, stopping at
 * whichever gate rejected it — an index read and no features on the byte axis,
 * canvas's 1kb density probe on the other.
 */
export function planRegionFetch({
  error,
  fetchCanceled,
  gateSkipsMeasuredViewport,
  isLoading,
  minimized,
  sources,
}: RegionFetchInputs): RegionFetchPlan {
  if (error || fetchCanceled) {
    return { kind: 'idle', reason: 'blocked' }
  }
  if (gateSkipsMeasuredViewport) {
    return { kind: 'idle', reason: 'measured' }
  }
  if (isLoading()) {
    return { kind: 'idle', reason: 'inFlight' }
  }
  if (minimized()) {
    return { kind: 'idle', reason: 'minimized' }
  }

  const {
    trackAssemblyNames,
    hasAssemblyName,
    visibleRegions,
    bufferedVisibleRegions,
    loadedRegion,
    isCacheValid,
  } = sources()

  for (const block of visibleRegions) {
    const regionAssemblyName = block.assemblyName
    if (
      !trackAssemblyNames.includes(regionAssemblyName) &&
      !trackAssemblyNames.some(name =>
        hasAssemblyName(name, regionAssemblyName),
      )
    ) {
      return {
        kind: 'assemblyMismatch',
        regionAssemblyName,
        trackAssemblyNames,
      }
    }
  }

  const bufferedByIndex = new Map(
    bufferedVisibleRegions.map(b => [b.displayedRegionIndex, b]),
  )
  const needed: IndexedRegion[] = []
  for (const block of visibleRegions) {
    // `&&` short-circuits, so on a run where the block is NOT covered
    // `isCacheValid`'s observables go untracked — the same shape as the
    // gated-trigger hazard in `installGlobalFetchAutorun`. It is safe here for a
    // reason worth stating rather than rediscovering: an uncovered block always
    // reaches `fetchNeeded`, and every way that can end re-wakes the autorun
    // through something it already tracks — a fetch bumps `fetchGeneration`, and
    // the two displays whose `fetchNeeded` can decline (sequence on `zoomedOut`,
    // variants before `sourcesBase` arrives) are woken by `view.visibleRegions`
    // and by `SettingsInvalidate` respectively. A new early return in a
    // `fetchNeeded` override has to satisfy that or the display wedges: see
    // CLAUDE.md, "`isCacheValid` and `rpcProps` are views, not actions".
    //
    // The retry check watches half of that rather than leaving it to this
    // comment: a `covered` plan following a `reload()` reports unless the
    // display says `loadingSuppressed` (sequence, whose `zoomedOut` implies it)
    // or `awaitingPrerequisite` (variants, until `sourcesBase` lands).
    if (
      isBlockCovered(loadedRegion(block.displayedRegionIndex), block) &&
      isCacheValid(block.displayedRegionIndex)
    ) {
      continue
    }
    // The buffered twin, never `block` itself — see `bufferedVisibleRegions`.
    const buffered = bufferedByIndex.get(block.displayedRegionIndex)
    if (buffered) {
      needed.push(buffered)
    }
  }
  return needed.length > 0
    ? { kind: 'fetch', needed }
    : { kind: 'idle', reason: 'covered' }
}
