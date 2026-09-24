import {
  createEmbeddedController,
  searchIndexKey,
  withHostOverrides,
} from '@jbrowse/product-core'

import JBrowseLinearGenomeView from './JBrowseLinearGenomeView/index.ts'
import { createViewStateAsync } from './createViewState.ts'

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
 * What the view is showing, as a value. Every field here can be re-stated at
 * any time through {@link LinearGenomeViewController.update}, which is the
 * point of separating it from the options that build the engine: a declarative
 * host — an anywidget traitlet, an htmlwidget re-render, an Observable cell —
 * holds the wanted state and hands it over whole, rather than diffing it into a
 * sequence of calls itself.
 */
export interface LinearGenomeViewState {
  /**
   * The tracks to have open (full configs, bare data-file URLs,
   * `{ uri, index? }`, or the trackId of one in the hub's catalog when
   * `assembly` is a hub). The complete wanted set, not an addition: a track the
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
   * finished drawing it: a `location` is handed to the same launch machinery a
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
  const { onLocationChange } = opts
  return createEmbeddedController(el, {
    assembly: opts.assembly,
    session: opts.session,
    state: opts,
    onError: opts.onError,
    Component: JBrowseLinearGenomeView,
    observers: {
      onFeatureSelect: opts.onFeatureSelect,
      onSessionChange: opts.onSessionChange,
      onLocationChange: onLocationChange
        ? ([loc]) => {
            if (typeof loc === 'string') {
              onLocationChange(loc)
            }
          }
        : undefined,
    },
    // a gene-name hit opens the track it was found in only for a host that
    // opens none of its own
    launchFor: (
      stated: LinearGenomeViewState,
      { location, tracks }: LinearGenomeViewState,
    ) =>
      stated.location !== undefined && location
        ? { loc: location, showHitTrack: !tracks?.length }
        : undefined,
    build: ({ resolved, tracks, view }) =>
      createViewStateAsync({
        assembly: resolved.assembly,
        tracks,
        aggregateTextSearchAdapters: withHostOverrides(
          resolved.aggregateTextSearchAdapters,
          opts.aggregateTextSearchAdapters,
          searchIndexKey,
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
