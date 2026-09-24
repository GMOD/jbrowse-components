import {
  createEmbeddedController,
  withHostOverrides,
} from '@jbrowse/product-core'

import JBrowseCircularGenomeView from './JBrowseCircularGenomeView/index.ts'
import createViewState from './createViewState.ts'

import type { ViewModel } from './createModel/createModel.ts'
import type { ViewStateOptions } from './createViewState.ts'
import type {
  AssemblyInput,
  LocalFileInput,
  SessionObservers,
  TrackInput,
} from '@jbrowse/product-core'

type SearchAdapters = ViewStateOptions['aggregateTextSearchAdapters']
// the open form: what a host hands over is runtime-shaped, so it goes through
// createViewState's validating `session` door
type SessionSnapshot = ViewStateOptions['session']

/**
 * What the ring is showing, as a value. Every field here can be re-stated at
 * any time through {@link CircularGenomeViewController.update}, which is the
 * point of separating it from the options that build the engine: a declarative
 * host — an anywidget traitlet, an htmlwidget re-render, an Observable cell —
 * holds the wanted state and hands it over whole, rather than diffing it into a
 * sequence of calls itself.
 *
 * The same two fields the view's own `launch` carries, which is what a URL
 * spec and a saved session carry too — so this is the vocabulary throughout,
 * not a controller-only one.
 */
export interface CircularGenomeViewState {
  /**
   * The tracks to have open (full configs, bare data-file URLs,
   * `{ uri, index? }`, or the trackId of one in the hub's catalog when
   * `assembly` is a hub). The complete wanted set, not an addition: a track the
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
  return createEmbeddedController(el, {
    assembly: opts.assembly,
    session: opts.session,
    state: opts,
    onError: opts.onError,
    Component: JBrowseCircularGenomeView,
    observers: {
      onFeatureSelect: opts.onFeatureSelect,
      onSessionChange: opts.onSessionChange,
    },
    launchFor: (
      stated: CircularGenomeViewState,
      { displayedRegionNames }: CircularGenomeViewState,
    ) =>
      stated.displayedRegionNames && displayedRegionNames
        ? {
            displayedRegionNames: displayedRegionNames.length
              ? displayedRegionNames
              : undefined,
          }
        : undefined,
    build: ({ resolved, tracks, view }) =>
      createViewState({
        assembly: resolved.assembly,
        tracks,
        aggregateTextSearchAdapters: withHostOverrides(
          resolved.aggregateTextSearchAdapters,
          opts.aggregateTextSearchAdapters,
          'textSearchAdapterId',
        ),
        localFiles: opts.localFiles,
        internetAccounts: opts.internetAccounts,
        plugins: opts.plugins,
        makeWorkerInstance: opts.makeWorkerInstance,
        configuration: opts.configuration,
        session: opts.session,
        view,
      }),
  })
}
