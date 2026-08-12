import { createElement } from 'react'

import { getEnv } from '@jbrowse/core/util'
import { guessTrackConf } from '@jbrowse/core/util/tracks'
import {
  observeSession,
  registerLocalFiles,
  resolveAssembly,
  resolveLocalFileUris,
} from '@jbrowse/product-core'
import { createRoot } from 'react-dom/client'

import JBrowseLinearGenomeView from './JBrowseLinearGenomeView/index.ts'
import createViewState from './createViewState.ts'
import { destroyViewState } from './destroyViewState.ts'

import type { ViewModel } from './createModel/createModel.ts'
import type { ViewStateOptions } from './createViewState.ts'
import type { BlobLocation } from '@jbrowse/core/util'
import type { LooseTrackInput } from '@jbrowse/core/util/tracks'
import type {
  AssemblyInput,
  LocalFileInput,
  SessionObservers,
} from '@jbrowse/product-core'

type Tracks = NonNullable<ViewStateOptions['tracks']>
type TrackConf = Record<string, unknown>
/** A full track config, a bare data-file URL, or `{ uri, index?, ...extra }` —
 * the loose forms are expanded via core's guessTrackConf at mount time. */
type TrackInput = string | TrackConf
type SearchAdapters = ViewStateOptions['aggregateTextSearchAdapters']
// What the controller accepts as a session. This API's audience is hosts that
// don't write TypeScript (anywidget, htmlwidgets, plain JS), and what they hand
// over — a decodeSession result, a snapshot they stored — is runtime-shaped by
// construction. So it takes the open form and routes it through
// createViewState's `session` door, which validates as MST applies it; the
// compiler-checked `defaultSession` slot could not accept a decoded session at
// all, which is what `decodeSession`'s own docs used to point hosts at.
type SessionSnapshot = ViewStateOptions['session']

function isLooseTrack(track: TrackInput): track is string | LooseTrackInput {
  return typeof track === 'string' || (!('adapter' in track) && 'uri' in track)
}

// Stamp the view's single assembly onto a full-config track that omits
// assemblyNames. The embedded view has exactly one assembly, so it's
// unambiguous — and doing it here frees every host (R htmlwidgets, anywidget,
// vanilla JS) from computing the name itself. Loose tracks get the same name
// through guessTrackConf's `assemblyName` argument below.
export function withAssemblyName(track: TrackConf, assemblyName?: string) {
  return assemblyName !== undefined && !('assemblyNames' in track)
    ? { ...track, assemblyNames: [assemblyName] }
    : track
}

// Expand any loose entries (bare URL, or { uri, index? }) into full track
// configs using core's guessTrackConf; full configs only get the assembly name
// stamped on. The view model carries the pluginManager whose format plugins
// drive the guess.
function resolveTracks(
  tracks: TrackInput[],
  viewState: ViewModel,
  assemblyName?: string,
  localFiles?: Record<string, BlobLocation>,
): Tracks {
  const { pluginManager } = getEnv(viewState)
  return tracks.map(track => {
    const conf = isLooseTrack(track)
      ? guessTrackConf(track, pluginManager, assemblyName)
      : // full configs are stamped here too, not just in the build() catalog
        // seed: a config that first appears through setTracks/addTrack never
        // passes through that seed, and would otherwise reach addTrackConf with
        // no assemblyNames and silently fail to display
        withAssemblyName(track, assemblyName)
    // after the guess, so the adapter has already derived its index sibling
    // from the uri string and both get swapped for blobs together
    return localFiles ? resolveLocalFileUris(conf, localFiles) : conf
  })
}

export interface CreateLinearGenomeViewOptions {
  assembly: AssemblyInput
  /** tracks to open (full configs, bare data-file URLs, or `{ uri, index? }`); a
   * `session` owns display instead when given */
  tracks?: TrackInput[]
  /** a serialized view; when present it owns the initial location and layout */
  /**
   * A saved session to open instead of `tracks`/`location` — what
   * `onSessionChange` handed you, or a {@link decodeSession} of a URL param.
   * Named for what it is: this is the restore slot, not a default the user's
   * own state layers on top of. `createApp` calls it the same thing.
   */
  session?: SessionSnapshot
  /** e.g. `chr1:1-1000` or a gene name; ignored when a `session` positions the view */
  location?: string
  /**
   * In-memory files, `name -> bytes`, that `tracks` may then refer to by that
   * name as if it were a URL — for a host whose data lives in a process rather
   * than at a URL (a notebook kernel, an R session), with no web server and no
   * CORS. They are read by byte range, so register an index under its
   * conventional sibling name (`peaks.bed.gz` + `peaks.bed.gz.tbi`) and the
   * file stays indexed: only the bytes the current view needs are touched.
   */
  localFiles?: LocalFileInput
  /** merged with any search adapters the resolved hub already provides */
  aggregateTextSearchAdapters?: SearchAdapters
  internetAccounts?: ViewStateOptions['internetAccounts']
  plugins?: ViewStateOptions['plugins']
  makeWorkerInstance?: ViewStateOptions['makeWorkerInstance']
  configuration?: ViewStateOptions['configuration']
  /** fires with the throttled visible region as the user pans/zooms */
  onLocationChange?: (location: string) => void
  /** fires with the serialized feature when one is clicked/selected */
  onFeatureSelect?: (feature: unknown) => void
  /**
   * fires with the layout as plain JSON when it settles, in the shape
   * the `session` option takes — for a host offering "save this view"
   */
  onSessionChange?: SessionObservers['onSessionChange']
  /**
   * fires when a build fails — a genome that won't resolve, a plugin that won't
   * fetch, a bad track config. Building is asynchronous, so the throw cannot
   * reach your call to this function; without this it only reaches the console
   * and the host is left showing an empty box. Defaults to `console.error`.
   */
  onError?: (error: unknown) => void
}

export interface LinearGenomeViewController {
  /**
   * The underlying MST model, once the build settles. This is the whole read
   * API: every `#getter` and `#property` on the view and session models is a
   * MobX observable, so a host reads state from the model rather than from a
   * callback per fact. Awaiting it is the only way to hold it — there is no
   * synchronous accessor, because there is exactly one engine per controller
   * and a host that has awaited this already has it.
   */
  whenReady(): Promise<ViewModel>
  setLocation(location: string): Promise<void>
  addTrack(track: TrackInput): void
  removeTrack(trackId: string): void
  /**
   * Register more in-memory files (see the `localFiles` option), for a host
   * whose data arrives after mount — a notebook cell that just finished
   * computing. Existing names are kept, so this only ever adds.
   */
  addLocalFiles(files: LocalFileInput): void
  /**
   * Unmount the view and tear the engine down — React root, RPC worker threads,
   * and the MST tree's autoruns. The controller is unusable afterwards.
   */
  destroy(): void
}

function mergeSearchAdapters(a: SearchAdapters, b: SearchAdapters) {
  const merged = [...(a ?? []), ...(b ?? [])]
  return merged.length ? merged : undefined
}

// register a track config only if the session can't already resolve it — then
// show it. The guard matters: addTrackConf only dedupes against sessionTracks,
// so re-adding a config already seeded into the config catalog (createViewState
// `tracks`) would push a duplicate into sessionTracks that then shadows the
// catalog entry. getTrackById resolves catalog + connection + session tracks,
// so this is idempotent on mount and on every later setTracks.
function openTrack(session: ViewModel['session'], conf: Tracks[number]) {
  if (!session.getTrackById(conf.trackId)) {
    session.addTrackConf(conf)
  }
  session.view.showTrack(conf.trackId)
}

// open every wanted track and close any others the view is currently showing
function reconcileTracks(viewState: ViewModel, tracks: Tracks) {
  const { session } = viewState
  const { view } = session
  const wanted = new Set(tracks.map(t => t.trackId))
  for (const conf of tracks) {
    openTrack(session, conf)
  }
  // materialize the ids first: hideTrack splices view.tracks, so iterating it
  // live would skip entries
  const unwanted = view.tracks
    .map(track => track.configuration.trackId)
    .filter(trackId => !wanted.has(trackId))
  for (const trackId of unwanted) {
    view.hideTrack(trackId)
  }
}

/**
 * Mount a JBrowse linear genome view imperatively into a DOM element and drive
 * it through a small controller. This is the framework-agnostic primitive every
 * non-React host (anywidget, htmlwidgets, vanilla JS, Observable, ...) wraps:
 * events flow out through `onLocationChange`/`onFeatureSelect`, mutations flow in
 * through the returned methods, and the controller owns the whole lifecycle
 * (async assembly resolution, rebuilds, teardown).
 */
export function createLinearGenomeView(
  el: HTMLElement,
  opts: CreateLinearGenomeViewOptions,
): LinearGenomeViewController {
  const {
    onLocationChange,
    onFeatureSelect,
    onSessionChange,
    onError = (e: unknown) => {
      console.error(e)
    },
  } = opts

  // Wanted state the build applies, kept mutable because the live methods
  // change it and because a call made before the async build resolves has to
  // land: `addTrack` before `whenReady()` must open that track when the engine
  // arrives, not be lost.
  let tracks: TrackInput[] = opts.tracks ?? []
  let location = opts.location
  // the resolved assembly name, stamped onto tracks guessed from a bare URL
  let assemblyName: string | undefined
  // each registration pushes a File into core's process-global blobMap, so
  // addLocalFiles only ever registers names it has not seen
  let localFiles = registerLocalFiles(opts.localFiles ?? {})

  const root = createRoot(el)
  let disposers: (() => void)[] = []
  let current: ViewModel | undefined
  let destroyed = false

  function teardown() {
    for (const dispose of disposers) {
      dispose()
    }
    disposers = []
  }

  // Runs exactly once: nothing here swaps the engine out from under a mounted
  // tree any more. The genome, the session and the track list are what the
  // engine is BUILT from, so changing one is a new browser — the host destroys
  // this controller and creates another, which is what `setAssembly`,
  // `setSession` and `setTracks` did internally before they were removed. That
  // is what retired the generation counter and the mounted-versus-current
  // split this function used to need: two builds could be in flight at once,
  // finishing in whatever order their fetches did rather than the order they
  // were asked for.
  async function build() {
    const resolved = await resolveAssembly(opts.assembly)
    // local until this build is known to have won: `assemblyName` is what later
    // addTrack/setTracks calls stamp onto bare configs, so a superseded build
    // promoting its own would misname every track added afterwards
    const name =
      typeof resolved.assembly.name === 'string'
        ? resolved.assembly.name
        : undefined
    const hasSession = opts.session !== undefined
    const viewState = createViewState({
      assembly: resolved.assembly,
      // forwarded so the *assembly* gets the same substitution — its sequence
      // adapter is a location like any other, and only createViewState has the
      // pluginManager that expands a `{ type, uri }` shorthand into one.
      // Registration is keyed on the bytes, so registering the same input in
      // both places mints one blob rather than two.
      localFiles: opts.localFiles,
      // only full configs seed the config catalog; loose specs need the
      // pluginManager the build creates, so they are resolved just below
      tracks: tracks
        .filter((track): track is TrackConf => !isLooseTrack(track))
        .map(track =>
          resolveLocalFileUris(withAssemblyName(track, name), localFiles),
        ),
      aggregateTextSearchAdapters: mergeSearchAdapters(
        resolved.aggregateTextSearchAdapters,
        opts.aggregateTextSearchAdapters,
      ),
      internetAccounts: opts.internetAccounts,
      plugins: opts.plugins,
      makeWorkerInstance: opts.makeWorkerInstance,
      configuration: opts.configuration,
      session: opts.session,
      // a session already positions the view; only route location
      // through createViewState's init flow (spinner while loading) otherwise
      location: hasSession ? undefined : location,
    })
    // Nothing will ever reach this engine, so it dies here rather than leaking
    // a worker pool. `destroyed` is reachable from React StrictMode, which runs
    // a ref callback's cleanup right after setup — i.e. before any build can
    // finish. Checked before the autoruns below are registered, so a dead
    // engine never gets one pointed at it.
    if (destroyed) {
      destroyViewState(viewState)
      return viewState
    }
    assemblyName = name
    // a restored session owns the initial track layout; without one, open the
    // configured tracks so they actually display
    if (!hasSession) {
      reconcileTracks(
        viewState,
        resolveTracks(tracks, viewState, assemblyName, localFiles),
      )
    }
    // The read-backs are product-core's, the same ones createApp wires, rather
    // than a second pair written here: this product has exactly one view, so
    // its single-string `onLocationChange` is that view's entry of the list.
    disposers.push(
      observeSession(viewState, {
        onFeatureSelect,
        onSessionChange,
        onLocationChange: onLocationChange
          ? ([loc]) => {
              // an unpositioned view reports undefined; a single-view product's
              // location is only ever the plain string
              if (typeof loc === 'string') {
                onLocationChange(loc)
              }
            }
          : undefined,
      }),
    )
    current = viewState
    root.render(createElement(JBrowseLinearGenomeView, { viewState }))
    return viewState
  }

  const ready = build()
  ready.catch(onError)

  return {
    whenReady() {
      return ready
    },
    async setLocation(loc) {
      location = loc
      const view = current?.session.view
      // navToLocString no-ops cleanly when already at loc (MST skips identical
      // offsetPx/bpPerPx writes), so no guard against the current position is
      // needed — and the previous coarseVisibleLocStrings comparison never
      // matched anyway (formatted "ctgA:1..100" vs a raw "ctgA:1-100"/gene input)
      if (view && loc) {
        await view.navToLocString(loc)
      }
    },
    addTrack(track) {
      tracks = [...tracks, track]
      if (current) {
        const [conf] = resolveTracks([track], current, assemblyName, localFiles)
        openTrack(current.session, conf)
      }
    },
    addLocalFiles(files) {
      // registering is what mints the blobIds, so only the new names pay for it
      const fresh = Object.fromEntries(
        Object.entries(files).filter(([name]) => !localFiles[name]),
      )
      localFiles = { ...localFiles, ...registerLocalFiles(fresh) }
    },
    removeTrack(trackId) {
      // loose specs have no trackId until resolved; a full config matching the
      // id is dropped, hideTrack closes it in the view regardless
      tracks = tracks.filter(t => isLooseTrack(t) || t.trackId !== trackId)
      current?.session.view.hideTrack(trackId)
    },
    destroy() {
      // set first: a build still in flight reads it and destroys the engine it
      // is about to hand back, rather than leaking that one's worker pool
      destroyed = true
      teardown()
      root.unmount()
      if (current) {
        destroyViewState(current)
      }
      current = undefined
    },
  }
}
