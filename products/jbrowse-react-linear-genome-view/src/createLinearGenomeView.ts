import { createElement } from 'react'

import {
  isLooseTrack,
  mergeLocalFiles,
  mergeSearchAdapters,
  observeSession,
  reconcileTracks,
  registerLocalFiles,
  resolveAssembly,
  resolveLocalFileUris,
  resolveTracks,
  withAssemblyName,
} from '@jbrowse/product-core'
import { createRoot } from 'react-dom/client'

import JBrowseLinearGenomeView from './JBrowseLinearGenomeView/index.ts'
import createViewState from './createViewState.ts'
import { destroyViewState } from './destroyViewState.ts'

import type { ViewModel } from './createModel/createModel.ts'
import type { ViewStateOptions } from './createViewState.ts'
import type {
  AssemblyInput,
  LocalFileInput,
  SessionObservers,
  TrackConf,
  TrackInput,
} from '@jbrowse/product-core'

type SearchAdapters = ViewStateOptions['aggregateTextSearchAdapters']
// What the controller accepts as a session. This API's audience is hosts that
// don't write TypeScript (anywidget, htmlwidgets, plain JS), and what they hand
// over — a decodeSession result, a snapshot they stored — is runtime-shaped by
// construction. So it takes the open form and routes it through
// createViewState's `session` door, which validates as MST applies it; the
// compiler-checked `defaultSession` slot could not accept a decoded session at
// all, which is what `decodeSession`'s own docs used to point hosts at.
type SessionSnapshot = ViewStateOptions['session']

/**
 * What the view is showing, as a value. Every field here can be re-stated at
 * any time through {@link LinearGenomeViewController.update}, which is the
 * point of separating it from the options that build the engine: a declarative
 * host — an anywidget traitlet, an htmlwidget re-render, an Observable cell —
 * holds the wanted state and hands it over whole, rather than diffing it into a
 * sequence of calls itself.
 */
export interface LinearGenomeViewState {
  /**
   * The tracks to have open (full configs, bare data-file URLs, or
   * `{ uri, index? }`). The complete wanted set, not an addition: a track the
   * view has open and this list omits gets closed.
   */
  tracks?: TrackInput[]
  /** where to look, e.g. `chr1:1-1000` or a gene name */
  location?: string
  /**
   * In-memory files, `name -> bytes`, that `tracks` may then refer to by that
   * name as if it were a URL — for a host whose data lives in a process rather
   * than at a URL (a notebook kernel, an R session), with no web server and no
   * CORS. They are read by byte range, so register an index under its
   * conventional sibling name (`peaks.bed.gz` + `peaks.bed.gz.tbi`) and the
   * file stays indexed: only the bytes the current view needs are touched.
   *
   * The one field that only grows: re-stating it registers names the controller
   * has not seen and keeps the rest, because a track config already points at
   * the blob a registered name minted.
   */
  localFiles?: LocalFileInput
}

export interface CreateLinearGenomeViewOptions extends LinearGenomeViewState {
  /**
   * The genome, as a sequence file URL (`.fa.gz`, `.2bit`), a hub name like
   * `'hg38'` or a GenArk accession, a whole hub config, or a bare assembly
   * config. Not part of {@link LinearGenomeViewState} because it is what the
   * engine is *built from*: changing it is a different browser, so a host that
   * swaps genomes destroys this controller and creates another.
   */
  assembly: AssemblyInput
  /**
   * A saved session to open instead of `tracks`/`location` — what
   * `onSessionChange` handed you, or a {@link decodeSession} of a URL param.
   * Named for what it is: this is the restore slot, not a default the user's
   * own state layers on top of. `createApp` calls it the same thing. A
   * build-time input too: it describes a whole tree rather than a field to
   * reconcile.
   */
  session?: SessionSnapshot
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
  /**
   * Bring the view to this state — the single write door, and a declarative
   * one: you state what you want to be true rather than the steps to get there.
   * Each field you state is the complete wanted value for it (`tracks` closes
   * whatever it omits), and a field you leave out is left alone, so a host
   * whose own state covers part of the view hands over that part.
   *
   * Resolves once the state has reached the view, not once the view has
   * finished drawing it: a `location` is handed to the same init machinery a
   * URL launch goes through, which waits for the assembly and then navigates.
   * Watch `onLocationChange` (or the model) to see it land. Safe to call before
   * the build settles — the state is recorded immediately and applied when the
   * engine arrives.
   */
  update(state: LinearGenomeViewState): Promise<void>
  /**
   * Unmount the view and tear the engine down — React root, RPC worker threads,
   * and the MST tree's autoruns. The controller is unusable afterwards.
   */
  destroy(): void
}

/**
 * Mount a JBrowse linear genome view imperatively into a DOM element and drive
 * it through a small controller. This is the framework-agnostic primitive every
 * non-React host (anywidget, htmlwidgets, vanilla JS, Observable, ...) wraps:
 * events flow out through `onLocationChange`/`onFeatureSelect`, the wanted
 * state flows in through `update`, and the controller owns the whole lifecycle
 * (async assembly resolution, reconciliation, teardown).
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

  // The wanted state, held as the mutable twin of what `update` takes. Held
  // rather than read back off the model because a build in flight has no model
  // yet: an `update` before `whenReady()` records here and is applied when the
  // engine arrives, instead of being lost.
  let tracks: TrackInput[] = opts.tracks ?? []
  let location = opts.location
  // the resolved assembly name, stamped onto tracks guessed from a bare URL
  let assemblyName: string | undefined
  // each registration pushes a File into core's process-global blobMap, so this
  // only ever grows, by names it has not seen
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
  // tree. The genome and the session are what the engine is BUILT from, so
  // changing one is a new browser — the host destroys this controller and
  // creates another. That is what retired the generation counter and the
  // mounted-versus-current split this function used to need: two builds could
  // be in flight at once, finishing in whatever order their fetches did rather
  // than the order they were asked for.
  async function build() {
    const resolved = await resolveAssembly(opts.assembly)
    // local until this build is known to have won: `assemblyName` is what a
    // later `update` stamps onto bare configs, so a superseded build promoting
    // its own would misname every track added afterwards
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
    // wanted tracks so they actually display
    if (!hasSession) {
      reconcileTracks(
        viewState.session,
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

  // Reconcile the live view to the wanted state, touching only the fields the
  // caller just stated: re-navigating on a tracks-only update would yank a user
  // who had panned since, and re-reconciling tracks on a location-only update
  // is work with nothing to show for it.
  function apply(state: LinearGenomeViewState) {
    if (!current) {
      return
    }
    if (state.tracks) {
      reconcileTracks(
        current.session,
        resolveTracks(tracks, current, assemblyName, localFiles),
      )
    }
    if (state.location !== undefined && location && assemblyName) {
      // Stated through the view's own `init` field rather than called as
      // navToLocString: the engine being built is not the assembly being
      // loaded, and a host that sets a location as soon as it has a widget —
      // which is when a notebook cell or a Shiny observer fires — hits a bare
      // navToLocString before there are refNames to resolve against, as an
      // unhandled rejection. The init autorun waits for `initialized` and runs
      // the same navToLocString, gene-name search included, then reports a
      // locstring that matched nothing as a snackbar rather than a throw.
      current.session.view.setInit({ assembly: assemblyName, loc: location })
    }
  }

  return {
    whenReady() {
      return ready
    },
    async update(state) {
      // recorded before the await, so an update landing mid-build is what
      // build() itself reconciles from rather than something applied twice by
      // halves. localFiles first: a track in the same update may name one
      if (state.localFiles) {
        localFiles = mergeLocalFiles(localFiles, state.localFiles)
      }
      if (state.tracks) {
        tracks = state.tracks
      }
      if (state.location !== undefined) {
        location = state.location
      }
      await ready
      apply(state)
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
