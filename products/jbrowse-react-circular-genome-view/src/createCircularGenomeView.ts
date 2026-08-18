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

import JBrowseCircularGenomeView from './JBrowseCircularGenomeView/index.ts'
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
// createViewState's `session` door, which validates as MST applies it.
type SessionSnapshot = ViewStateOptions['session']

/**
 * What the ring is showing, as a value. Every field here can be re-stated at
 * any time through {@link CircularGenomeViewController.update}, which is the
 * point of separating it from the options that build the engine: a declarative
 * host — an anywidget traitlet, an htmlwidget re-render, an Observable cell —
 * holds the wanted state and hands it over whole, rather than diffing it into a
 * sequence of calls itself.
 *
 * The same two fields the view's own `init` blob carries, which is what a URL
 * spec and a saved session carry too — so this is the vocabulary throughout,
 * not a controller-only one.
 */
export interface CircularGenomeViewState {
  /**
   * The tracks to have open (full configs, bare data-file URLs, or
   * `{ uri, index? }`). The complete wanted set, not an addition: a track the
   * view has open and this list omits gets closed.
   *
   * The circular view draws chord tracks, and a VCF is what the bundled plugin
   * set knows how to chord — so `'sv.vcf.gz'` works as a bare URL, while a file
   * that guesses to some other track type reports that no compatible display
   * exists rather than leaving a silently empty ring.
   */
  tracks?: TrackInput[]
  /**
   * Restrict the ring to these chromosomes, in the order given — the main
   * chromosomes without the unplaced/alt contigs, which otherwise take a slice
   * each. Names resolve through the assembly's aliases and may be globs. An
   * empty list means the whole assembly, which is also what omitting it at
   * build time means.
   */
  displayedRegionNames?: string[]
  /**
   * In-memory files, `name -> bytes`, that `tracks` may then refer to by that
   * name as if it were a URL — for a host whose data lives in a process rather
   * than at a URL (a notebook kernel, an R session), with no web server and no
   * CORS. They are read by byte range, so register an index under its
   * conventional sibling name (`sv.vcf.gz` + `sv.vcf.gz.tbi`) and the file
   * stays indexed: only the bytes the current view needs are touched.
   *
   * The one field that only grows: re-stating it registers names the controller
   * has not seen and keeps the rest, because a track config already points at
   * the blob a registered name minted.
   */
  localFiles?: LocalFileInput
}

export interface CreateCircularGenomeViewOptions extends CircularGenomeViewState {
  /**
   * The genome, as a sequence file URL (`.fa.gz`, `.2bit`), a hub name like
   * `'hg38'` or a GenArk accession, a whole hub config, or a bare assembly
   * config. Not part of {@link CircularGenomeViewState} because it is what the
   * engine is *built from*: changing it is a different browser, so a host that
   * swaps genomes destroys this controller and creates another.
   */
  assembly: AssemblyInput
  /**
   * A saved session to open instead of `tracks`/`displayedRegionNames` — what
   * `onSessionChange` handed you, or a {@link decodeSession} of a URL param.
   * Named for what it is: this is the restore slot, not a default the user's
   * own state layers on top of. A build-time input too: it describes a whole
   * tree rather than a field to reconcile.
   */
  session?: SessionSnapshot
  /** merged with any search adapters the resolved hub already provides */
  aggregateTextSearchAdapters?: SearchAdapters
  internetAccounts?: ViewStateOptions['internetAccounts']
  plugins?: ViewStateOptions['plugins']
  makeWorkerInstance?: ViewStateOptions['makeWorkerInstance']
  configuration?: ViewStateOptions['configuration']
  /** fires with the serialized feature when a chord is clicked/selected */
  onFeatureSelect?: (feature: unknown) => void
  /**
   * fires with the layout as plain JSON when it settles, in the shape the
   * `session` option takes — for a host offering "save this view"
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

export interface CircularGenomeViewController {
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
   * Safe to call before the build settles: the state is recorded immediately
   * and applied when the engine arrives.
   */
  update(state: CircularGenomeViewState): Promise<void>
  /**
   * Unmount the view and tear the engine down — React root, RPC worker threads,
   * and the MST tree's autoruns. The controller is unusable afterwards.
   */
  destroy(): void
}

/**
 * Mount a JBrowse circular genome view imperatively into a DOM element and
 * drive it through a small controller. This is the framework-agnostic primitive
 * every non-React host (anywidget, htmlwidgets, vanilla JS, Observable, ...)
 * wraps: events flow out through `onFeatureSelect`/`onSessionChange`, the
 * wanted state flows in through `update`, and the controller owns the whole
 * lifecycle (async assembly resolution, reconciliation, teardown).
 *
 * There is no `onLocationChange`, unlike the linear controller's: a circular
 * view has no visible region to report — it draws every displayed region at
 * once — so the read-back would only ever fire `undefined`. What changes here
 * is which chromosomes are on the ring, and `onSessionChange` carries that.
 */
export function createCircularGenomeView(
  el: HTMLElement,
  opts: CreateCircularGenomeViewOptions,
): CircularGenomeViewController {
  const {
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
  let displayedRegionNames = opts.displayedRegionNames
  // the resolved assembly name, stamped onto tracks guessed from a bare URL and
  // named by every init blob this controller writes
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
  // creates another.
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
      // a session already positions the ring; only route the region names
      // through createViewState's init flow otherwise
      displayedRegionNames: hasSession ? undefined : displayedRegionNames,
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
    disposers.push(
      observeSession(viewState, { onFeatureSelect, onSessionChange }),
    )
    current = viewState
    root.render(createElement(JBrowseCircularGenomeView, { viewState }))
    return viewState
  }

  const ready = build()
  ready.catch(onError)

  // Reconcile the live view to the wanted state, touching only the fields the
  // caller just stated: rebuilding the ring on a tracks-only update would redo
  // the region resolution for nothing.
  function apply(state: CircularGenomeViewState) {
    if (!current) {
      return
    }
    if (state.tracks) {
      reconcileTracks(
        current.session,
        resolveTracks(tracks, current, assemblyName, localFiles),
      )
    }
    if (state.displayedRegionNames && assemblyName) {
      // Re-driven through the view's own `init` field rather than by resolving
      // the names here and calling setDisplayedRegions: the init autorun
      // re-fires on every setInit and owns the resolution — aliases, globs, and
      // the warning when a name matches nothing. A second implementation here
      // would be the one that drops the ring to its import form on a typo.
      current.session.view.setInit({
        assembly: assemblyName,
        displayedRegionNames: displayedRegionNames?.length
          ? displayedRegionNames
          : undefined,
      })
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
      if (state.displayedRegionNames) {
        displayedRegionNames = state.displayedRegionNames
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
